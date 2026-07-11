import { Router } from 'express';
import { addToWaitlist, cancelHold, confirmHold, createClaim, createDrop, getDrop, getMyAccount } from '../controllers/drop.controller.js';

export const dropRouter = Router();
dropRouter.post('/admin/drops', createDrop);
dropRouter.get('/drops/:dropId', getDrop);
dropRouter.post('/drops/:dropId/claims', createClaim);
dropRouter.post('/holds/:holdId/confirm', confirmHold);
dropRouter.delete('/holds/:holdId', cancelHold);
dropRouter.post('/drops/:dropId/waitlist', addToWaitlist);
dropRouter.get('/me', getMyAccount);
