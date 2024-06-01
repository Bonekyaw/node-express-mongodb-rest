const { ObjectId } = require("mongodb");

/*
 * Pagination
 * There are two methods: offset-based and cursor-based paginations.
 * This is offset-based pagination.
 */
exports.offset = async (
  model,
  page = 1,
  limit = 10,
  filters = null,
  fields = null,
  sort = null,
  lookup_1 = null
) => {
  const skip = (page - 1) * limit;

  let options = [{ $skip: skip }, { $limit: limit }];
  if (lookup_1) {
    options = [...options, { $lookup: lookup_1 }];
  }
  if (fields) {
    options = [...options, { $project: fields }];
  }

  let totalCount = [{ $count: "count" }];
  if (filters) {
    totalCount = [{ $match: filters }, ...totalCount];
  }

  let aggregatePipeline = [];
  if (filters) {
    aggregatePipeline = [{ $match: filters }];
  }
  if (sort) {
    aggregatePipeline = [...aggregatePipeline, { $sort: sort }];
  }

  aggregatePipeline = [
    ...aggregatePipeline,
    { $facet: { data: options, totalCount: totalCount } },
  ];

  try {
    const results = await model.aggregate(aggregatePipeline).toArray();
    const rows = results[0]?.data || [];
    const totalDocuments = results[0]?.totalCount[0]?.count || 0;

    return {
      total: totalDocuments,
      data: rows,
      currentPage: page,
      previousPage: page == 1 ? null : page - 1,
      nextPage: page * limit >= totalDocuments ? null : page + 1,
      lastPage: Math.ceil(totalDocuments / limit),
      countPerPage: limit,
    };
  } catch (error) {
    error.status = 500;
    throw error;
  }
};

exports.noCount = async (
  model,
  page = 1,
  limit = 10,
  filters = null,
  fields = null,
  sort = null,
  lookup_1 = null
) => {
  const skip = (page - 1) * limit;

  let aggregatePipeline = [];
  if (filters) {
    aggregatePipeline = [{ $match: filters }];
  }
  if (sort) {
    aggregatePipeline = [...aggregatePipeline, { $sort: sort }];
  }
  aggregatePipeline = [
    ...aggregatePipeline,
    { $skip: skip },
    { $limit: limit + 1},
  ];
  if (lookup_1) {
    aggregatePipeline = [...aggregatePipeline, { $lookup: lookup_1 }];
  }
  if (fields) {
    aggregatePipeline = [...aggregatePipeline, { $project: fields }];
  }

  try {
    const collections = await model.aggregate(aggregatePipeline).toArray();
    let hasNextPage = false;
    if (collections.length > limit) {
      // if got an extra result
      hasNextPage = true; // has a next page of results
      collections.pop(); // remove extra result
    }

    return {
      data: collections,
      currentPage: page,
      previousPage: page == 1 ? null : page - 1,
      nextPage: hasNextPage ? page + 1 : null,
      countPerPage: limit,
    };
  } catch (error) {
    error.status = 500;
    throw error;
  }
};

/*
 * Pagination
 * There are two methods: offset-based and cursor-based paginations.
 * This is cursor-based pagination.
 */
exports.cursor = async (
  model,
  cursor,
  limit = 10,
  filters = null,
  fields = null,
  sort = { createdAt: -1 },
  lookup_1 = null
) => {
  const cursorR = cursor ? ObjectId.createFromHexString(cursor) : null;

  let query = {};
  // Add cursor-based filter
  if (cursorR) {
    query._id = { $lt: cursorR };
  }

  if (filters) {
    query = { ...query, ...filters };
  }

  let aggregatePipeline = [];
  if (cursor || filters) {
    aggregatePipeline = [{ $match: query }];
  }
  if (sort) {
    aggregatePipeline = [...aggregatePipeline, { $sort: sort }];
  }
  aggregatePipeline = [
    ...aggregatePipeline,
    { $limit: limit + 1},
  ];
  if (lookup_1) {
    aggregatePipeline = [...aggregatePipeline, { $lookup: lookup_1 }];
  }
  if (fields) {
    aggregatePipeline = [...aggregatePipeline, { $project: fields }];
  }

  try {
    const results = await model.aggregate(aggregatePipeline).toArray();

    const hasNextPage = results.length > limit;
    if (hasNextPage) {
      results.pop(); // Remove the extra document if it exists
    }
    const lastPost = results[results.length - 1];

    return {
      data: results,
      nextCursor: hasNextPage ? lastPost._id : null,
    };
  } catch (error) {
    error.status = 500;
    throw error;
  }
};

// count = await model.estimatedDocumentCount(filters); // For Large Datasets
// collections = await model.find(filters, fields, sort, {skip: skip}, {limit: limit}).toArray();
// collections = await model
//   .find(filters)
//   .project(fields)
//   .sort(sort)
//   .skip(skip)
//   .limit(limit)
//   .toArray();
