import { Request, Response, NextFunction } from 'express';
import { QueryTypes, Op, WhereOptions } from 'sequelize';
import { sequelize } from '../db';
import { asyncWrapper } from '../middleware';
import {
  SnippetInstance,
  SnippetModel,
  Snippet_TagModel,
  TagModel
} from '../models';
import {
  ErrorResponse,
  tagParser,
  createTags,
  SnippetBody,
  SearchBody
} from '../utils';

const withTags = {
  model: TagModel,
  as: 'tags',
  attributes: ['name'],
  through: {
    attributes: []
  }
};

const notFound = (id: string) =>
  new ErrorResponse(404, `Snippet with id of ${id} was not found`);

/** Only whitelisted, validated fields ever reach the model (no mass assignment) */
const toAttributes = (body: SnippetBody) => ({
  title: body.title,
  description: body.description,
  language: body.language,
  code: body.code,
  docs: body.docs,
  isPinned: body.isPinned ? 1 : 0
});

const serialize = (snippet: SnippetInstance) => {
  const raw = snippet.get({ plain: true });

  return {
    ...raw,
    isPinned: !!raw.isPinned,
    tags: raw.tags?.map(tag => tag.name) ?? []
  };
};


/**
 * @description Create new snippet
 * @route /api/snippets
 * @request POST
 */
export const createSnippet = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const body = <SnippetBody>req.body;
    const parsedTags = tagParser([...body.tags, body.language.toLowerCase()]);

    const snippet = await sequelize.transaction(async () => {
      const snippet = await SnippetModel.create(toAttributes(body));
      await createTags(parsedTags, snippet.id);
      return snippet;
    });

    res.status(201).json({
      data: {
        ...snippet.get({ plain: true }),
        isPinned: body.isPinned,
        tags: [...parsedTags]
      }
    });
  }
);

/**
 * @description Get all snippets
 * @route /api/snippets
 * @request GET
 */
export const getAllSnippets = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const snippets = await SnippetModel.findAll({
      include: withTags,
      order: [['updatedAt', 'DESC']]
    });

    res.status(200).json({
      data: snippets.map(serialize)
    });
  }
);

/**
 * @description Get single snippet by id
 * @route /api/snippets/:id
 * @request GET
 */
export const getSnippet = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const snippet = await SnippetModel.findByPk(String(req.params.id), {
      include: withTags
    });

    if (!snippet) {
      return next(notFound(String(req.params.id)));
    }

    res.status(200).json({
      data: serialize(snippet)
    });
  }
);

/**
 * @description Update snippet
 * @route /api/snippets/:id
 * @request PUT
 */
export const updateSnippet = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const snippet = await SnippetModel.findByPk(String(req.params.id));

    if (!snippet) {
      return next(notFound(String(req.params.id)));
    }

    const body = <SnippetBody>req.body;
    const parsedTags = tagParser([...body.tags, body.language.toLowerCase()]);

    await sequelize.transaction(async () => {
      await snippet.update(toAttributes(body));
      await Snippet_TagModel.destroy({ where: { snippet_id: snippet.id } });
      await createTags(parsedTags, snippet.id);
    });

    res.status(200).json({
      data: {
        ...snippet.get({ plain: true }),
        isPinned: body.isPinned,
        tags: [...parsedTags]
      }
    });
  }
);

/**
 * @description Pin / unpin snippet
 * @route /api/snippets/:id/pin
 * @request PATCH
 */
export const setPinned = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const snippet = await SnippetModel.findByPk(String(req.params.id), {
      include: withTags
    });

    if (!snippet) {
      return next(notFound(String(req.params.id)));
    }

    await snippet.update({ isPinned: req.body.isPinned ? 1 : 0 });

    res.status(200).json({
      data: serialize(snippet)
    });
  }
);

/**
 * @description Delete snippet
 * @route /api/snippets/:id
 * @request DELETE
 */
export const deleteSnippet = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const snippet = await SnippetModel.findByPk(String(req.params.id));

    if (!snippet) {
      return next(notFound(String(req.params.id)));
    }

    await sequelize.transaction(async () => {
      await Snippet_TagModel.destroy({ where: { snippet_id: snippet.id } });
      await snippet.destroy();
    });

    res.status(200).json({
      data: {}
    });
  }
);

/**
 * @description Count tags
 * @route /api/snippets/statistics/count
 * @request GET
 */
export const countTags = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const result = await sequelize.query(
      `SELECT
        COUNT(tags.name) as count,
        tags.name
      FROM snippets_tags
      INNER JOIN tags ON snippets_tags.tag_id = tags.id
      GROUP BY tags.name
      ORDER BY name ASC`,
      {
        type: QueryTypes.SELECT
      }
    );

    res.status(200).json({
      data: result
    });
  }
);

/**
 * @description Get raw snippet code
 * @route /api/snippets/raw/:id
 * @request GET
 */
export const getRawCode = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const snippet = await SnippetModel.findByPk(String(req.params.id), { raw: true });

    if (!snippet) {
      return next(notFound(String(req.params.id)));
    }

    // res.send(string) would default to text/html -> stored XSS.
    // Force plain text and forbid any active content.
    res
      .status(200)
      .type('text/plain; charset=utf-8')
      .set({
        'X-Content-Type-Options': 'nosniff',
        'Content-Security-Policy': "default-src 'none'; sandbox",
        'Content-Disposition': 'inline'
      })
      .send(snippet.code);
  }
);

/**
 * @description Search snippets
 * @route /api/snippets/search
 * @request POST
 */
export const searchSnippets = asyncWrapper(
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { query, tags, languages } = <SearchBody>req.body;

    if (query === '' && !tags.length && !languages.length) {
      res.status(200).json({
        data: []
      });

      return;
    }

    const conditions: WhereOptions[] = [];

    if (query) {
      conditions.push({
        [Op.or]: [
          { title: { [Op.substring]: query } },
          { description: { [Op.substring]: query } },
          { code: { [Op.substring]: query } }
        ]
      });
    }

    if (languages.length) {
      conditions.push({ language: { [Op.in]: languages } });
    }

    const snippets = await SnippetModel.findAll({
      where: { [Op.and]: conditions },
      include: tags.length
        ? { ...withTags, where: { name: { [Op.in]: tags } } }
        : withTags,
      order: [['updatedAt', 'DESC']]
    });

    res.status(200).json({
      data: snippets.map(serialize)
    });
  }
);
