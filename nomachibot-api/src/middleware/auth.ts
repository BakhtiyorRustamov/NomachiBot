import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1]; // Bearer <token>
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      res.status(500).json({ error: 'Server configuration error' });
      return;
    }

    jwt.verify(token, jwtSecret, (err, user) => {
      if (err) {
        res.status(403).json({ error: 'Invalid or expired token' });
        return;
      }

      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ error: 'Authorization header missing' });
  }
};

// Optional auth — sets req.user if a valid JWT is present, but never blocks the request
export const optionalAuthenticateJWT = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    const jwtSecret = process.env.JWT_SECRET;
    if (jwtSecret) {
      try {
        req.user = jwt.verify(token, jwtSecret);
      } catch {
        // Invalid token — proceed without user
      }
    }
  }
  next();
};
