import config from '../config/env.config.js';
import { createError, ErrorDictionary } from '../utils/errors.js';
import jwt from 'jsonwebtoken';

const parseRole = (value) => {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
};

const getBearerToken = (authorizationHeader) => {
  if (typeof authorizationHeader !== 'string') return '';

  const [scheme, token] = authorizationHeader.trim().split(/\s+/);
  if (!scheme || !token) return '';
  if (scheme.toLowerCase() !== 'bearer') return '';

  return token;
};

const extractRoleFromPayload = (payload) => {
  const directRole = parseRole(payload?.role);
  if (directRole) {
    return directRole;
  }

  if (Array.isArray(payload?.roles)) {
    const firstValidRole = payload.roles.find((role) => parseRole(role));
    return parseRole(firstValidRole);
  }

  return '';
};

export const requireAuth = (req, _res, next) => {
  if (!config.authRequired) {
    return next();
  }

  if (!config.jwtSecret) {
    return next(createError(
      ErrorDictionary.SERVICE_UNAVAILABLE_ERROR.name,
      'Configuración incompleta: JWT_SECRET es obligatorio cuando AUTH_REQUIRED=true',
      ErrorDictionary.SERVICE_UNAVAILABLE_ERROR.status,
      ErrorDictionary.SERVICE_UNAVAILABLE_ERROR.code
    ));
  }

  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return next(createError(
      ErrorDictionary.UNAUTHORIZED_ERROR.name,
      'Autenticación requerida. Enviar Authorization: Bearer <token>',
      ErrorDictionary.UNAUTHORIZED_ERROR.status,
      ErrorDictionary.UNAUTHORIZED_ERROR.code
    ));
  }

  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch (error) {
    return next(error);
  }

  const role = extractRoleFromPayload(payload);
  if (!role) {
    return next(createError(
      ErrorDictionary.UNAUTHORIZED_ERROR.name,
      'Token inválido: no contiene un rol utilizable',
      ErrorDictionary.UNAUTHORIZED_ERROR.status,
      ErrorDictionary.UNAUTHORIZED_ERROR.code
    ));
  }

  req.auth = {
    role,
    userId: payload?.sub ?? payload?.userId ?? null,
    tokenPayload: payload
  };

  return next();
};

export const requireRoles = (allowedRoles) => [
  requireAuth,
  (req, _res, next) => {
    if (!config.authRequired) {
      return next();
    }

    if (!req.auth?.role || !allowedRoles.includes(req.auth.role)) {
      return next(createError(
        ErrorDictionary.PERMISSION_DENIED_ERROR.name,
        'Permiso denegado para el rol actual',
        ErrorDictionary.PERMISSION_DENIED_ERROR.status,
        ErrorDictionary.PERMISSION_DENIED_ERROR.code
      ));
    }

    return next();
  }
];
