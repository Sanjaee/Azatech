import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../types';
import { ordersService } from './orders.service';
import {
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamSchema,
} from './orders.schema';
import { sendSuccess } from '../../utils/response';

export class OrdersController {
  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = createOrderSchema.parse(req.body);
      const idempotencyKey = (req.headers['idempotency-key'] as string | undefined)?.trim();
      const userId = req.user?.sub;
      const order = await ordersService.createOrder(body, { idempotencyKey, userId });
      sendSuccess(res, order, 'Order created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async list(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listOrdersQuerySchema.parse(req.query);
      const { items, meta } = await ordersService.listOrders(query);
      sendSuccess(res, items, 'Orders retrieved successfully', 200, meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = orderIdParamSchema.parse(req.params);
      const order = await ordersService.getOrderById(id);
      sendSuccess(res, order, 'Order details retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async pay(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = orderIdParamSchema.parse(req.params);
      const order = await ordersService.payOrder(id);
      sendSuccess(res, order, 'Order marked as PAID', 200);
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = orderIdParamSchema.parse(req.params);
      const order = await ordersService.cancelOrder(id);
      sendSuccess(res, order, 'Order cancelled and stock restored', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const ordersController = new OrdersController();
