import { Request, Response, NextFunction } from 'express';
import { customersService } from './customers.service';
import { createCustomerSchema, listCustomersQuerySchema } from './customers.schema';
import { sendSuccess } from '../../utils/response';

export class CustomersController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listCustomersQuerySchema.parse(req.query);
      const { items, meta } = await customersService.list(query);
      sendSuccess(res, items, 'Customers retrieved successfully', 200, meta);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = createCustomerSchema.parse(req.body);
      const customer = await customersService.create(body);
      sendSuccess(res, customer, 'Customer created successfully', 201);
    } catch (error) {
      next(error);
    }
  }
}

export const customersController = new CustomersController();
