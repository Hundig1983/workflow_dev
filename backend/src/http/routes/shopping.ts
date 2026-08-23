import type { FastifyInstance } from 'fastify';
import type pg from 'pg';
import {
  addItem,
  checkItem,
  clearList,
  createList,
  editItem,
  getListDetail,
  getLists,
  removeItem,
  removeList,
  renameList,
  uncheckItem,
} from '../../shopping/service.js';
import { makeRequireFamilyScope, makeRequireSession } from '../auth-guard.js';
import { fail } from '../errors.js';

/**
 * `pattern: '\\S'` rejects whitespace-only names at the schema layer; the service
 * trims before persisting and the DB CHECK is the last line of defense.
 */
const listBody = {
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: { name: { type: 'string', minLength: 1, maxLength: 120, pattern: '\\S' } },
} as const;

const itemCreateBody = {
  type: 'object',
  required: ['name'],
  additionalProperties: false,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 200, pattern: '\\S' },
    quantity: { type: 'string', maxLength: 100 },
    note: { type: 'string', maxLength: 500 },
  },
} as const;

const itemPatchBody = {
  type: 'object',
  additionalProperties: false,
  minProperties: 1,
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 200, pattern: '\\S' },
    quantity: { type: ['string', 'null'], maxLength: 100 },
    note: { type: ['string', 'null'], maxLength: 500 },
  },
} as const;

const listParams = {
  type: 'object',
  required: ['listId'],
  additionalProperties: false,
  properties: { listId: { type: 'string', format: 'uuid' } },
} as const;

const itemParams = {
  type: 'object',
  required: ['listId', 'itemId'],
  additionalProperties: false,
  properties: {
    listId: { type: 'string', format: 'uuid' },
    itemId: { type: 'string', format: 'uuid' },
  },
} as const;

interface ListP {
  Params: { listId: string };
}
interface ItemP {
  Params: { listId: string; itemId: string };
}

export function registerShoppingRoutes(app: FastifyInstance, pool: pg.Pool): void {
  const preHandler = [makeRequireSession(pool), makeRequireFamilyScope(pool)];
  const base = '/families/me/shopping-lists';

  /** One place maps service results onto the error envelope — messages deliberately
   *  identical for "absent" and "another family's" (no existence leak, Article I.1). */
  function refuse(reply: Parameters<typeof fail>[0], kind: 'list_not_found' | 'item_not_found') {
    return kind === 'list_not_found'
      ? fail(reply, 404, 'not_found', 'Shopping list not found.')
      : fail(reply, 404, 'not_found', 'Item not found.');
  }

  app.post<{ Body: { name: string } }>(
    base,
    { schema: { body: listBody }, preHandler },
    async (request, reply) => {
      const scope = request.familyScope;
      if (!scope) return fail(reply, 401, 'unauthenticated', 'Authentication required.');
      const list = await createList(pool, scope, request.body.name);
      return reply.status(201).send(list);
    },
  );

  app.get(base, { preHandler }, async (request, reply) => {
    const scope = request.familyScope;
    if (!scope) return fail(reply, 401, 'unauthenticated', 'Authentication required.');
    return reply.status(200).send({ lists: await getLists(pool, scope) });
  });

  app.get<ListP>(
    `${base}/:listId`,
    { schema: { params: listParams }, preHandler },
    async (request, reply) => {
      const scope = request.familyScope;
      if (!scope) return fail(reply, 401, 'unauthenticated', 'Authentication required.');
      const result = await getListDetail(pool, scope, request.params.listId);
      if (result.kind !== 'ok') return refuse(reply, result.kind);
      return reply.status(200).send(result.value);
    },
  );

  app.patch<ListP & { Body: { name: string } }>(
    `${base}/:listId`,
    { schema: { params: listParams, body: listBody }, preHandler },
    async (request, reply) => {
      const scope = request.familyScope;
      if (!scope) return fail(reply, 401, 'unauthenticated', 'Authentication required.');
      const result = await renameList(pool, scope, request.params.listId, request.body.name);
      if (result.kind !== 'ok') return refuse(reply, result.kind);
      return reply.status(200).send(result.value);
    },
  );

  app.delete<ListP>(
    `${base}/:listId`,
    { schema: { params: listParams }, preHandler },
    async (request, reply) => {
      const scope = request.familyScope;
      if (!scope) return fail(reply, 401, 'unauthenticated', 'Authentication required.');
      const result = await removeList(pool, scope, request.params.listId);
      if (result.kind !== 'ok') return refuse(reply, result.kind);
      return reply.status(204).send();
    },
  );

  app.post<ListP & { Body: { name: string; quantity?: string; note?: string } }>(
    `${base}/:listId/items`,
    { schema: { params: listParams, body: itemCreateBody }, preHandler },
    async (request, reply) => {
      const scope = request.familyScope;
      if (!scope) return fail(reply, 401, 'unauthenticated', 'Authentication required.');
      const result = await addItem(pool, scope, request.params.listId, request.body);
      if (result.kind !== 'ok') return refuse(reply, result.kind);
      return reply.status(201).send(result.value);
    },
  );

  const itemRoute = `${base}/:listId/items/:itemId`;

  app.patch<ItemP & { Body: { name?: string; quantity?: string | null; note?: string | null } }>(
    itemRoute,
    { schema: { params: itemParams, body: itemPatchBody }, preHandler },
    async (request, reply) => {
      const scope = request.familyScope;
      if (!scope) return fail(reply, 401, 'unauthenticated', 'Authentication required.');
      const result = await editItem(
        pool,
        scope,
        request.params.listId,
        request.params.itemId,
        request.body,
      );
      if (result.kind !== 'ok') return refuse(reply, result.kind);
      return reply.status(200).send(result.value);
    },
  );

  app.post<ItemP>(
    `${itemRoute}/check`,
    { schema: { params: itemParams }, preHandler },
    async (request, reply) => {
      const scope = request.familyScope;
      if (!scope) return fail(reply, 401, 'unauthenticated', 'Authentication required.');
      const result = await checkItem(pool, scope, request.params.listId, request.params.itemId);
      if (result.kind !== 'ok') return refuse(reply, result.kind);
      return reply.status(200).send(result.value);
    },
  );

  app.post<ItemP>(
    `${itemRoute}/uncheck`,
    { schema: { params: itemParams }, preHandler },
    async (request, reply) => {
      const scope = request.familyScope;
      if (!scope) return fail(reply, 401, 'unauthenticated', 'Authentication required.');
      const result = await uncheckItem(pool, scope, request.params.listId, request.params.itemId);
      if (result.kind !== 'ok') return refuse(reply, result.kind);
      return reply.status(200).send(result.value);
    },
  );

  app.delete<ItemP>(
    itemRoute,
    { schema: { params: itemParams }, preHandler },
    async (request, reply) => {
      const scope = request.familyScope;
      if (!scope) return fail(reply, 401, 'unauthenticated', 'Authentication required.');
      const result = await removeItem(pool, scope, request.params.listId, request.params.itemId);
      if (result.kind !== 'ok') return refuse(reply, result.kind);
      return reply.status(204).send();
    },
  );

  app.post<ListP>(
    `${base}/:listId/clear`,
    { schema: { params: listParams }, preHandler },
    async (request, reply) => {
      const scope = request.familyScope;
      if (!scope) return fail(reply, 401, 'unauthenticated', 'Authentication required.');
      const result = await clearList(pool, scope, request.params.listId);
      if (result.kind !== 'ok') return refuse(reply, result.kind);
      return reply.status(200).send(result.value);
    },
  );
}
