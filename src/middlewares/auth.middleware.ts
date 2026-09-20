import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../utils/auth';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}

export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = verifyToken(token);
      req.user = decoded;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  }

  return res.status(401).json({ error: 'Authorization header required' });
};

export const optionalJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = verifyToken(token);
      req.user = decoded;
    } catch (err) {
      // Ignore token errors for optional auth
    }
  }
  next();
};

export const requireRole = (allowedRoles: Array<string>) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRoles = req.user.role.split(',').map((r) => r.trim());

    // If allowed contains ADMIN or LEADERSHIP, allow both LEADERSHIP and ADMIN
    const expandedAllowed = [...allowedRoles];
    if (allowedRoles.includes('ADMIN')) expandedAllowed.push('LEADERSHIP');
    if (allowedRoles.includes('LEADERSHIP')) expandedAllowed.push('ADMIN');

    const hasRole = expandedAllowed.some((allowed) => userRoles.includes(allowed));

    if (!hasRole) {
      return res.status(403).json({ error: 'Forbidden: Insufficient team permissions' });
    }

    next();
  };
};
