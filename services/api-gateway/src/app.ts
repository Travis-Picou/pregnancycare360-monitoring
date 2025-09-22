/**
 * PregnancyCare 360 - API Gateway
 * 
 * Central API gateway that handles authentication, routing, rate limiting,
 * and request/response transformation for all microservices.
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';
import jwt from 'jsonwebtoken';
import Redis from 'ioredis';
import { v4 as uuidv4 } from 'uuid';
import { Logger } from '../../../packages/shared/src/utils/logger';
import { ApiResponse, UserRole } from '../../../packages/shared/src/types';
import { validateRequest } from './middleware/validation';
import { auditLogger } from './middleware/audit';
import { errorHandler } from './middleware/error-handler';
import { healthCheck } from './routes/health';
import { authRoutes } from './routes/auth';
import { metricsCollector } from './middleware/metrics';

// Initialize Express app
const app: Application = express();
const logger = new Logger('API-Gateway');
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "https:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001', 'http://localhost:3002'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-User-Role']
};

app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.headers['x-request-id']);
  next();
});

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration,
      requestId: req.headers['x-request-id'],
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
  });
  
  next();
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests from this IP, please try again later.'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    // Use user ID if authenticated, otherwise IP
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (token) {
      try {
        const decoded = jwt.decode(token) as any;
        return `user:${decoded.userId}`;
      } catch (error) {
        // Fall back to IP if token is invalid
      }
    }
    return req.ip;
  }
});

app.use(limiter);

// Metrics collection
app.use(metricsCollector);

// Audit logging
app.use(auditLogger);

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    role: UserRole;
    permissions: string[];
  };
}

const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_TOKEN',
        message: 'Access token is required'
      }
    });
  }

  try {
    // Check if token is blacklisted
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_BLACKLISTED',
          message: 'Token has been revoked'
        }
      });
    }

    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    // Get user details from cache or database
    let user = await redis.get(`user:${decoded.userId}`);
    if (!user) {
      // Fetch from user service if not in cache
      // This would typically make a call to the user service
      // For now, we'll use the decoded token data
      user = JSON.stringify({
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
        permissions: decoded.permissions || []
      });
      
      // Cache for 15 minutes
      await redis.setex(`user:${decoded.userId}`, 900, user);
    }

    req.user = JSON.parse(user);
    next();
  } catch (error) {
    logger.error('Token verification failed', { error, token: token.substring(0, 20) + '...' });
    
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      }
    });
  }
};

// Role-based authorization middleware
const authorize = (roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required'
        }
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      });
    }

    next();
  };
};

// ============================================================================
// SERVICE PROXY CONFIGURATION
// ============================================================================

const serviceConfig = {
  'patient-service': {
    target: process.env.PATIENT_SERVICE_URL || 'http://localhost:3001',
    pathRewrite: { '^/api/patients': '' },
    changeOrigin: true,
    timeout: 30000
  },
  'provider-service': {
    target: process.env.PROVIDER_SERVICE_URL || 'http://localhost:3002',
    pathRewrite: { '^/api/providers': '' },
    changeOrigin: true,
    timeout: 30000
  },
  'ai-ml-service': {
    target: process.env.AI_ML_SERVICE_URL || 'http://localhost:8000',
    pathRewrite: { '^/api/ai': '' },
    changeOrigin: true,
    timeout: 60000 // AI operations may take longer
  },
  'notification-service': {
    target: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3003',
    pathRewrite: { '^/api/notifications': '' },
    changeOrigin: true,
    timeout: 30000
  },
  'integration-service': {
    target: process.env.INTEGRATION_SERVICE_URL || 'http://localhost:3004',
    pathRewrite: { '^/api/integrations': '' },
    changeOrigin: true,
    timeout: 45000
  }
};

// Create proxy middleware for each service
Object.entries(serviceConfig).forEach(([serviceName, config]) => {
  const proxy = createProxyMiddleware({
    ...config,
    onProxyReq: (proxyReq, req: AuthenticatedRequest) => {
      // Add user context to proxied requests
      if (req.user) {
        proxyReq.setHeader('X-User-ID', req.user.userId);
        proxyReq.setHeader('X-User-Role', req.user.role);
        proxyReq.setHeader('X-User-Email', req.user.email);
      }
      
      // Add request ID for tracing
      proxyReq.setHeader('X-Request-ID', req.headers['x-request-id'] as string);
      
      logger.debug(`Proxying request to ${serviceName}`, {
        method: req.method,
        url: req.url,
        target: config.target,
        requestId: req.headers['x-request-id']
      });
    },
    onProxyRes: (proxyRes, req, res) => {
      // Add CORS headers to proxied responses
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      
      logger.debug(`Received response from ${serviceName}`, {
        statusCode: proxyRes.statusCode,
        requestId: req.headers['x-request-id']
      });
    },
    onError: (err, req, res) => {
      logger.error(`Proxy error for ${serviceName}`, {
        error: err.message,
        requestId: req.headers['x-request-id']
      });
      
      res.status(502).json({
        success: false,
        error: {
          code: 'SERVICE_UNAVAILABLE',
          message: `${serviceName} is currently unavailable`
        }
      });
    }
  });

  // Apply authentication to all service routes except health checks
  const routePath = `/api/${serviceName.replace('-service', 's')}`;
  app.use(routePath, (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Skip auth for health checks
    if (req.path === '/health') {
      return next();
    }
    
    authenticateToken(req, res, next);
  }, proxy);
});

// ============================================================================
// DIRECT ROUTES
// ============================================================================

// Health check endpoint
app.use('/health', healthCheck);

// Authentication routes (no auth required)
app.use('/api/auth', authRoutes);

// API documentation
app.get('/api/docs', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      title: 'PregnancyCare 360 API',
      version: '1.0.0',
      description: 'AI-Powered Pregnancy Monitoring Platform API',
      endpoints: {
        authentication: '/api/auth',
        patients: '/api/patients',
        providers: '/api/providers',
        ai: '/api/ai',
        notifications: '/api/notifications',
        integrations: '/api/integrations'
      },
      documentation: 'https://docs.pregnancycare360.com/api'
    }
  });
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      service: 'PregnancyCare 360 API Gateway',
      version: '1.0.0',
      status: 'healthy',
      timestamp: new Date().toISOString()
    }
  });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// 404 handler
app.use('*', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.originalUrl} not found`
    }
  });
});

// Global error handler
app.use(errorHandler);

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

const gracefulShutdown = (signal: string) => {
  logger.info(`Received ${signal}, shutting down gracefully`);
  
  // Close Redis connection
  redis.disconnect();
  
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default app;