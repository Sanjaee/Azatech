import { Request, Response, NextFunction } from 'express';
import { ordersService } from './orders.service';
import {
  createOrderSchema,
  listOrdersQuerySchema,
  orderIdParamSchema,
} from './orders.schema';
import { sendSuccess } from '../../utils/response';

export class OrdersController {
  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = createOrderSchema.parse(req.body);
      const order = await ordersService.createOrder(body);
      sendSuccess(res, order, 'Order created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listOrdersQuerySchema.parse(req.query);
      const { items, meta } = await ordersService.listOrders(query);
      sendSuccess(res, items, 'Orders retrieved successfully', 200, meta);
    } catch (error) {
      next(error);
    }
  }

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = orderIdParamSchema.parse(req.params);
      const order = await ordersService.getOrderById(id);
      sendSuccess(res, order, 'Order details retrieved successfully', 200);
    } catch (error) {
      next(error);
    }
  }

  async pay(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = orderIdParamSchema.parse(req.params);
      const order = await ordersService.payOrder(id);
      sendSuccess(res, order, 'Order marked as PAID', 200);
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: Request, res: Response, next: NextFunction): Promise<void> {
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
