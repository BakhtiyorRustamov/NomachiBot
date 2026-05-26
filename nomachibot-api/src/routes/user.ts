import express, { Response } from 'express';
import { authenticateJWT, AuthRequest } from '../middleware/auth';
import { prisma } from '../db';

const router = express.Router();

// Get current user profile (Requires JWT)
router.get('/me', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        first_name: true,
        last_name: true,
        username: true,
        created_at: true
      }
    });

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
