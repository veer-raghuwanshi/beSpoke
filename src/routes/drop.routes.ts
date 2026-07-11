import { Router } from 'express';
import { addToWaitlist, createClaim, getDrop } from '../controllers/drop.controller.js';
import { createDrop } from '../controllers/admin-drop.controller.js';
import { cancelHold, confirmHold } from '../controllers/hold.controller.js';
import { getMyAccount } from '../controllers/account.controller.js';

export const dropRouter = Router();
dropRouter.post('/admin/drops', createDrop);
dropRouter.get('/drops/:dropId', getDrop);
dropRouter.post('/drops/:dropId/claims', createClaim);
dropRouter.post('/holds/:holdId/confirm', confirmHold);
dropRouter.delete('/holds/:holdId', cancelHold);
dropRouter.post('/drops/:dropId/waitlist', addToWaitlist);
dropRouter.get('/me', getMyAccount);
