import { RequestHandler } from 'express';
import { Hold, Purchase, Wallet } from '../repositories/drop.repository.js';
import { userIdFrom } from '../middleware/auth.js';

export const getMyAccount: RequestHandler = async (req, res, next) => {
  try {
    const userId = userIdFrom(req);

    const [wallet, holds, purchases] = 
    await Promise.all([
      Wallet.findOne({ userId }),
      Hold.find({ userId }).sort({ createdAt: -1 }),
      Purchase.find({ userId }).sort({ createdAt: -1 }),
    ]);
    res.json({ wallet: wallet?.balance ?? 0, holds, purchases });
  } catch (error) {
    next(error);
  }
};
