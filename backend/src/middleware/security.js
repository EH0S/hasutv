import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import config from '../config/index.js';

// Create a reusable rate limiter factory with customizable settings
const createRateLimiter = (windowMs, maxRequests, message = 'Too many requests from this IP, please try again later.') => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    message: {
      error: 'Too Many Requests',
      message
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.status(429).json({
        error: 'Too Many Requests',
        message
      });
    },
    keyGenerator: (req) => req.ip,
    // Add custom header function
    onLimitReached: (req, res) => {
      // Headers will be set by handler
    },
    // Skip function
    skip: (req) => false,
    // Store to track request counts
    store: undefined // Use default memory store
  });
};

// General API rate limiter - Apply to most endpoints
export const generalRateLimiter = createRateLimiter(
  config.security.rateLimitWindow,
  config.security.rateLimitMax
);

// Auth rate limiter - More restrictive for auth routes to prevent brute force
export const authRateLimiter = createRateLimiter(
  60 * 1000, // 1 minute
  5,         // 5 requests per minute
  'Too many authentication attempts, please try again later.'
);

// User data rate limiter - As specified in the test
export const userDataRateLimiter = createRateLimiter(
  15 * 60 * 1000, // 15 minutes
  100,            // 100 requests per window
  'Rate limit exceeded for user data access. Please try again later.'
);

// Uploads rate limiter - Restrict file uploads
export const uploadsRateLimiter = createRateLimiter(
  5 * 60 * 1000, // 5 minutes
  10,            // 10 upload requests per window
  'Too many upload requests. Please try again later.'
);

// Export the default rate limiter for backward compatibility
export const rateLimiter = generalRateLimiter;

// Security headers middleware using helmet
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
});

// XSS sanitization middleware
export const sanitizeInput = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key]
          .replace(/[<>]/g, '')
          .trim();
      }
    });
  }
  next();
};

// CORS configuration middleware
export const corsOptions = {
  origin: (origin, callback) => {
    const origins = config.cors.origin;
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin matches any of the allowed patterns
    const isAllowed = Array.isArray(origins)
      ? origins.some(pattern => {
          if (pattern instanceof RegExp) {
            return pattern.test(origin);
          }
          return pattern === origin;
        })
      : origin === origins;

    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed'));
    }
  },
  methods: config.cors.methods,
  allowedHeaders: config.cors.allowedHeaders,
  credentials: config.cors.credentials,
  maxAge: config.cors.maxAge,
  optionsSuccessStatus: 204,
};
