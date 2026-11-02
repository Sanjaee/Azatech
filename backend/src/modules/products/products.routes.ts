import { Router } from 'express';
import { productsController } from './products.controller';
import { requireAuth } from '../../middleware/auth.middleware';

export const productsRouter = Router();

productsRouter.use(requireAuth);

productsRouter.get('/', (req, res, next) => productsController.list(req, res, next));
productsRouter.post('/', (req, res, next) => productsController.create(req, res, next));
productsRouter.put('/:id', (req, res, next) => productsController.update(req, res, next));
