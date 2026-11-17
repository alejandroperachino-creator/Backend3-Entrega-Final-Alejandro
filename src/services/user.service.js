import UserRepository from '../repositories/user.repository.js';
import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import bcrypt from 'bcrypt';
import { USER_ROLES, VALID_DOCUMENT_TYPES } from '../constants/index.js';
import { createError, ErrorDictionary } from '../utils/errors.js';
import logger from '../utils/logger.js';

class UserService {
    constructor() {
        this.userRepository = new UserRepository();
    }

    async addDocument(id, file, type) {
        if (!file) {
            this.throwServiceError(ErrorDictionary.MISSING_FILE);
        }

        const normalizedType = this.normalizeDocumentType(type);
        this.validateDocumentType(normalizedType, id, type);
        const user = await this.getUserOrFail(id);
        const uploadedFileHash = await this.hashFile(file.path);

        const documents = Array.isArray(user.documents) ? [...user.documents] : [];
        await this.ensureDocumentBinaryIsUnique(documents, uploadedFileHash, id);
        documents.push(this.buildDocumentPayload(file, normalizedType, uploadedFileHash));

        const updatedUser = await this.userRepository.updateById(id, { documents });
        logger.info('Documento de usuario cargado correctamente', {
            userId: id,
            fileName: file.filename,
            documentType: normalizedType || 'document',
            totalDocuments: documents.length
        });

        return updatedUser;
    }

    async getAllUsers(query = {}) {
        const pagination = this.buildPagination(query);
        const filter = {};

        if (query.role) {
            filter.role = String(query.role).trim().toLowerCase();
        }

        if (query.email) {
            filter.email = String(query.email).trim().toLowerCase();
        }

        return this.userRepository.findAll({ filter, pagination });
    }

    async getUserById(id) {
        logger.debug(`buscando usuario por ID: ${id}`);
        return this.getUserOrFail(id);
    }

    async createUser(userData) {
        this.validateRequiredUserData(userData);

        const { email } = userData;
        const existingUser = await this.userRepository.findByEmail(email);
        if (existingUser) {
            this.throwServiceError(ErrorDictionary.RESOURCE_CONFLICT_ERROR);
        }

        this.validateAllowedRole(userData.role);

        const hashedPassword = await this.hashPassword(userData.password);

        return this.userRepository.create({
            ...userData,
            password: hashedPassword,
            email: this.normalizeEmail(email),
            role: userData.role || USER_ROLES.USER
        });
    }

    async updateUser(id, userData) {
        if (userData.role === USER_ROLES.ADMIN) {
            this.throwServiceError(ErrorDictionary.PERMISSION_DENIED_ERROR);
        }

        const updateData = { ...userData };
        if (typeof updateData.password === 'string' && updateData.password.trim()) {
            updateData.password = await this.hashPassword(updateData.password);
        }

        const updatedUser = await this.userRepository.updateById(id, updateData);
        if (!updatedUser) {
            this.throwServiceError(ErrorDictionary.USER_NOT_FOUND_ERROR);
        }

        return updatedUser;
    }

    async deleteUser(id) {
        const deletedUser = await this.userRepository.deleteById(id);
        if (!deletedUser) {
            this.throwServiceError(ErrorDictionary.USER_NOT_FOUND_ERROR);
        }

        return deletedUser;
    }

    async getUserOrFail(userId) {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            this.throwServiceError(ErrorDictionary.USER_NOT_FOUND_ERROR);
        }

        return user;
    }

    validateRequiredUserData(userData) {
        const requiredFields = ['firstName', 'lastName', 'email', 'password'];
        const hasMissingField = requiredFields.some((field) => !userData[field]);
        if (hasMissingField) {
            this.throwServiceError(ErrorDictionary.BAD_REQUEST_ERROR);
        }
    }

    validateAllowedRole(role) {
        if (role === USER_ROLES.ADMIN) {
            throw createError(
                ErrorDictionary.PERMISSION_DENIED_ERROR.name,
                'No se puede crear un admin desde este endpoint',
                ErrorDictionary.PERMISSION_DENIED_ERROR.status,
                ErrorDictionary.PERMISSION_DENIED_ERROR.code
            );
        }
    }

    normalizeEmail(email) {
        return email.toLowerCase().trim();
    }

    normalizeDocumentType(type) {
        return typeof type === 'string' ? type.trim().toLowerCase() : '';
    }

    validateDocumentType(normalizedType, userId, requestedType) {
        if (normalizedType && !VALID_DOCUMENT_TYPES.includes(normalizedType)) {
            logger.warning('Tipo de documento inválido para usuario', {
                userId,
                type: requestedType,
                validTypes: VALID_DOCUMENT_TYPES
            });

            this.throwServiceError(ErrorDictionary.INVALID_DOCUMENT_TYPE);
        }
    }

    async ensureDocumentBinaryIsUnique(documents, uploadedFileHash, userId) {
        for (const docItem of documents) {
            const existingDocument = docItem?.document;
            if (!existingDocument) {
                continue;
            }

            let existingFileHash = typeof existingDocument.hash === 'string' ? existingDocument.hash.trim().toLowerCase() : '';
            if (!existingFileHash) {
                const existingPath = existingDocument.path;
                if (!existingPath || typeof existingPath !== 'string') {
                    continue;
                }

                try {
                    existingFileHash = await this.hashFile(existingPath);
                    existingDocument.hash = existingFileHash;
                } catch (error) {
                    logger.warning('No se pudo calcular hash de documento existente para comparación', {
                        userId,
                        existingPath,
                        error: error.message
                    });
                    continue;
                }
            }

            if (existingFileHash === uploadedFileHash) {
                throw createError(
                    ErrorDictionary.RESOURCE_CONFLICT_ERROR.name,
                    'El usuario ya tiene cargado este mismo archivo',
                    ErrorDictionary.RESOURCE_CONFLICT_ERROR.status,
                    ErrorDictionary.RESOURCE_CONFLICT_ERROR.code
                );
            }
        }
    }

    async hashFile(filePath) {
        return new Promise((resolve, reject) => {
            const hash = createHash('sha256');
            const stream = createReadStream(filePath);

            stream.on('error', reject);
            stream.on('data', (chunk) => hash.update(chunk));
            stream.on('end', () => resolve(hash.digest('hex')));
        });
    }

    async hashPassword(password) {
        const rounds = 10;
        return bcrypt.hash(password, rounds);
    }

    buildDocumentPayload(file, normalizedType, fileHash) {
        const documentType = normalizedType || 'document';

        return {
            name: file.originalname,
            reference: file.filename,
            document: {
                originalName: file.originalname,
                fileName: file.filename,
                path: file.path,
                mimetype: file.mimetype,
                size: file.size,
                type: documentType,
                hash: fileHash,
                uploadedAt: new Date()
            }
        };
    }

    throwServiceError(errorDefinition) {
        throw createError(
            errorDefinition.name,
            errorDefinition.message,
            errorDefinition.status,
            errorDefinition.code
        );
    }

    buildPagination(query) {
        const DEFAULT_LIMIT = 20;
        const MAX_LIMIT = 100;
        const page = Number(query.page) > 0 ? Number(query.page) : 1;
        const requestedLimit = Number(query.limit) > 0 ? Number(query.limit) : DEFAULT_LIMIT;
        const limit = Math.min(requestedLimit, MAX_LIMIT);

        return {
            limit,
            skip: (page - 1) * limit
        };
    }
}

export default UserService;