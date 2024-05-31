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
  filters = {},
  fields = {},
  sort = {},
  lookup_1
) => {
  const skip = (page - 1) * limit;
  try {
    const aggregatePipeline = lookup_1
      ? [
          { $match: filters },
          { $sort: sort },
          {
            $facet: {
              data: [
                { $skip: skip },
                { $limit: limit },
                { $lookup: lookup_1 },
                { $project: fields },
              ],
              totalCount: [{ $match: filters }, { $count: "count" }],
            },
          },
        ]
      : [
          { $match: filters },
          { $sort: sort },
          {
            $facet: {
              data: [{ $skip: skip }, { $limit: limit }, { $project: fields }],
              totalCount: [{ $match: filters }, { $count: "count" }],
            },
          },
        ];
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
  filters = {},
  fields = {},
  sort = {},
  lookup_1
) => {
  const skip = (page - 1) * limit;

  try {
    const aggregatePipeline = lookup_1
      ? [
          { $match: filters },
          { $sort: sort },
          { $skip: skip },
          { $limit: limit },
          { $lookup: lookup_1 },
          { $project: fields },
        ]
      : [
          { $match: filters },
          { $sort: sort },
          { $skip: skip },
          { $limit: limit },
          { $project: fields },
        ];

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
  filters = {},
  fields = {},
  sort = { _id: -1 },
  lookup_1
) => {
  const cursorR = cursor ? ObjectId.createFromHexString(cursor) : null;

  let filter = {};
  // Add cursor-based filter
  if (cursorR) {
    filter._id = { $gt: cursorR };
  }

  if (filters) {
    filter = { ...filter, ...filters };
  }

  try {
    const aggregatePipeline = lookup_1
      ? [
          { $match: filter }, // Apply filters
          { $sort: sort }, // Sort by _id in ascending order
          { $limit: limit + 1 },
          { $project: fields }, // Project fields
        ]
      : [
          { $match: filter }, // Apply filters
          { $sort: sort }, // Sort by _id in ascending order
          { $limit: limit + 1 },
          { $project: fields }, // Project fields
        ];

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
