import mongoose from 'mongoose';
import { createError, ErrorDictionary } from '../utils/errors.js';

const nextBadRequest = (next, details) => next(createError(
  ErrorDictionary.BAD_REQUEST_ERROR.name,
  ErrorDictionary.BAD_REQUEST_ERROR.message,
  ErrorDictionary.BAD_REQUEST_ERROR.status,
  ErrorDictionary.BAD_REQUEST_ERROR.code,
  details
));

export const validateObjectIdParam = (paramName = 'id') => (req, _res, next) => {
  const value = req.params?.[paramName];
  if (!mongoose.Types.ObjectId.isValid(value)) {
    return next(createError(
      ErrorDictionary.INVALID_ID_ERROR.name,
      ErrorDictionary.INVALID_ID_ERROR.message,
      ErrorDictionary.INVALID_ID_ERROR.status,
      ErrorDictionary.INVALID_ID_ERROR.code
    ));
  }

  return next();
};

export const requireBodyFields = (requiredFields) => (req, _res, next) => {
  const missingField = requiredFields.find((field) => !req.body?.[field]);
  if (missingField) {
    return nextBadRequest(next, { missingField });
  }

  return next();
};

export const requireNonEmptyBody = (req, _res, next) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return nextBadRequest(next, { reason: 'empty_body' });
  }

  return next();
};

export const validateOrderItems = (req, _res, next) => {
  const { items } = req.body || {};
  if (!Array.isArray(items) || items.length === 0) {
    return nextBadRequest(next, { reason: 'invalid_items_array' });
  }

  const invalidItem = items.find(
    (item) => !item || !item.name || Number(item.quantity) <= 0 || Number(item.price) < 0
  );

  if (invalidItem) {
    return nextBadRequest(next, { reason: 'invalid_item_shape' });
  }

  return next();
};
