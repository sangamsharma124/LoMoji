/**
 * Security Middleware
 * Production-ready security for Express API
 */

import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import validator from 'validator';

/**
 * Rate Limiting Configuration
 */

// General API rate limit
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for trusted IPs (optional)
    const trustedIPs = process.env.TRUSTED_IPS?.split(',') || [];
    return trustedIPs.includes(req.ip);
  },
});

// Strict rate limit for authentication endpoints
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Only 5 login attempts per 15 minutes
  message: {
    success: false,
    error: 'Too many login attempts, please try again after 15 minutes.',
  },
  skipSuccessfulRequests: true,
});

// Rate limit for file uploads
export const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 uploads per hour
  message: {
    success: false,
    error: 'Upload limit exceeded. Please try again later.',
  },
});

// Rate limit for project creation
export const createLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 projects per hour
  message: {
    success: false,
    error: 'Project creation limit exceeded. Please try again later.',
  },
});

/**
 * Helmet Configuration - Security Headers
 */
export const helmetConfig = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'", 'https://api.iosense.io'],
      frameSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/**
 * Input Sanitization Middleware
 */
export function sanitizeInput(req, res, next) {
  // Sanitize request body
  if (req.body) {
    sanitizeObject(req.body);
  }

  // Sanitize query parameters
  if (req.query) {
    sanitizeObject(req.query);
  }

  // Sanitize URL parameters
  if (req.params) {
    sanitizeObject(req.params);
  }

  next();
}

function sanitizeObject(obj) {
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      // Remove potentially dangerous characters
      obj[key] = validator.escape(obj[key].trim());

      // Additional sanitization
      obj[key] = obj[key]
        .replace(/<script[^>]*>.*?<\/script>/gi, '')
        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '');
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitizeObject(obj[key]);
    }
  }
}

/**
 * MongoDB Injection Protection
 */
export const mongoSanitizeConfig = mongoSanitize({
  replaceWith: '_',
  onSanitize: ({ req, key }) => {
    console.warn(`Sanitized potential NoSQL injection attempt: ${key}`);
  },
});

/**
 * Input Validation Helpers
 */
export const validators = {
  email: (email) => {
    if (!validator.isEmail(email)) {
      throw new Error('Invalid email address');
    }
    return validator.normalizeEmail(email);
  },

  password: (password) => {
    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      throw new Error('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      throw new Error('Password must contain at least one number');
    }
    return password;
  },

  username: (username) => {
    if (username.length < 3 || username.length > 20) {
      throw new Error('Username must be between 3 and 20 characters');
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      throw new Error('Username can only contain letters, numbers, and underscores');
    }
    return username;
  },

  url: (url) => {
    if (!validator.isURL(url, { require_protocol: true })) {
      throw new Error('Invalid URL');
    }
    return url;
  },

  mongoId: (id) => {
    if (!validator.isMongoId(id)) {
      throw new Error('Invalid ID format');
    }
    return id;
  },

  filename: (filename) => {
    // Remove path traversal attempts
    const safe = filename.replace(/\.\./g, '').replace(/[\/\\]/g, '');
    if (safe.length === 0) {
      throw new Error('Invalid filename');
    }
    return safe;
  },

  projectName: (name) => {
    if (name.length < 1 || name.length > 100) {
      throw new Error('Project name must be between 1 and 100 characters');
    }
    return validator.escape(name.trim());
  },
};

/**
 * Validation Middleware Factory
 */
export function validateRequest(schema) {
  return (req, res, next) => {
    try {
      const errors = [];

      // Validate body
      if (schema.body) {
        for (const [field, validator] of Object.entries(schema.body)) {
          const value = req.body[field];

          if (validator.required && !value) {
            errors.push(`${field} is required`);
            continue;
          }

          if (value && validator.type) {
            if (typeof value !== validator.type) {
              errors.push(`${field} must be of type ${validator.type}`);
              continue;
            }
          }

          if (value && validator.validate) {
            try {
              req.body[field] = validator.validate(value);
            } catch (error) {
              errors.push(`${field}: ${error.message}`);
            }
          }

          if (value && validator.min && value.length < validator.min) {
            errors.push(`${field} must be at least ${validator.min} characters`);
          }

          if (value && validator.max && value.length > validator.max) {
            errors.push(`${field} must not exceed ${validator.max} characters`);
          }
        }
      }

      // Validate query params
      if (schema.query) {
        for (const [field, validator] of Object.entries(schema.query)) {
          const value = req.query[field];

          if (validator.required && !value) {
            errors.push(`Query parameter '${field}' is required`);
            continue;
          }

          if (value && validator.validate) {
            try {
              req.query[field] = validator.validate(value);
            } catch (error) {
              errors.push(`${field}: ${error.message}`);
            }
          }
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          errors,
        });
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}

/**
 * CORS Configuration
 */
export const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:5173',
      'http://localhost:3000',
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
};

/**
 * File Upload Security
 */
export const fileUploadConfig = {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 5,
  },
  fileFilter: (req, file, cb) => {
    // Allowed file types
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      'application/json',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images and JSON files are allowed.'));
    }
  },
};

/**
 * Authentication Token Validation
 */
export function validateToken(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      });
    }

    // Validate token format (JWT)
    if (!validator.isJWT(token)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token format',
      });
    }

    // TODO: Verify token with your JWT library
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // req.user = decoded;

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
}

/**
 * Permission Check Middleware
 */
export function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (!req.user.permissions?.includes(permission) && !req.user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }

    next();
  };
}

/**
 * Project Ownership Verification
 */
export async function verifyProjectOwnership(req, res, next) {
  try {
    const { projectId } = req.params;
    const userId = req.user.id || req.user._id;

    // TODO: Check if user owns the project
    // const project = await Project.findById(projectId);
    // if (!project || project.userId.toString() !== userId.toString()) {
    //   return res.status(403).json({
    //     success: false,
    //     error: 'You do not have permission to access this project'
    //   });
    // }

    next();
  } catch (error) {
    next(error);
  }
}

/**
 * Security Headers Middleware
 */
export function securityHeaders(req, res, next) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Prevent MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Strict transport security
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Permissions policy
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  next();
}

export default {
  apiLimiter,
  authLimiter,
  uploadLimiter,
  createLimiter,
  helmetConfig,
  sanitizeInput,
  mongoSanitizeConfig,
  validators,
  validateRequest,
  corsOptions,
  fileUploadConfig,
  validateToken,
  requirePermission,
  verifyProjectOwnership,
  securityHeaders,
};
