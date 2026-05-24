/** @param {number} status */
export function isViewTokenUnavailableStatus(status) {
  return status === 400 || status === 404;
}
