/** Розбір query-параметрів пагінації/сортування зі стандартними межами. */
export function parsePagination(query, { defaultLimit = 25, maxLimit = 100 } = {}) {
  let page = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);

  if (!Number.isFinite(page) || page < 1) page = 1;
  if (!Number.isFinite(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;

  return { page, limit, offset: (page - 1) * limit };
}

/** Метаінформація для відповіді зі списком. */
export function paginationMeta(total, page, limit) {
  const totalNum = Number(total) || 0;
  return {
    total: totalNum,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(totalNum / limit)),
  };
}
