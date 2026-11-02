import { Router } from 'express';
import { customersController } from './customers.controller';
import { requireAuth } from '../../middleware/auth.middleware';

export const customersRouter = Router();

customersRouter.use(requireAuth);

customersRouter.get('/', (req, res, next) => customersController.list(req, res, next));
customersRouter.post('/', (req, res, next) => customersController.create(req, res, next));
