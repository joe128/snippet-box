import { Router } from 'express';
import {
  countTags,
  createSnippet,
  deleteSnippet,
  getAllSnippets,
  getRawCode,
  getSnippet,
  searchSnippets,
  setPinned,
  updateSnippet
} from '../controllers/snippets';
import { validateBody, validateId } from '../middleware';
import { pinSchema, searchSchema, snippetSchema } from '../utils';

export const snippetRouter = Router();

snippetRouter
  .route('/snippets')
  .post(validateBody(snippetSchema), createSnippet)
  .get(getAllSnippets);

snippetRouter.get('/snippets/statistics/count', countTags);
snippetRouter.get('/snippets/raw/:id', validateId, getRawCode);
snippetRouter.post('/snippets/search', validateBody(searchSchema), searchSnippets);
snippetRouter.patch('/snippets/:id/pin', validateId, validateBody(pinSchema), setPinned);

snippetRouter
  .route('/snippets/:id')
  .all(validateId)
  .get(getSnippet)
  .put(validateBody(snippetSchema), updateSnippet)
  .delete(deleteSnippet);
