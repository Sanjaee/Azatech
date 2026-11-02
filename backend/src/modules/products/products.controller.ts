import { Request, Response, NextFunction } from 'express';
import { productsService } from './products.service';
import {
  createProductSchema,
  listProductsQuerySchema,
  productIdParamSchema,
  updateProductSchema,
} from './products.schema';
import { sendSuccess } from '../../utils/response';

export class ProductsController {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listProductsQuerySchema.parse(req.query);
      const { items, meta } = await productsService.list(query);
      sendSuccess(res, items, 'Products retrieved successfully', 200, meta);
    } catch (error) {
      next(error);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = createProductSchema.parse(req.body);
      const product = await productsService.create(body);
      sendSuccess(res, product, 'Product created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = productIdParamSchema.parse(req.params);
      const body = updateProductSchema.parse(req.body);
      const product = await productsService.update(id, body);
      sendSuccess(res, product, 'Product updated successfully', 200);
    } catch (error) {
      next(error);
    }
  }
}

export const productsController = new ProductsController();
