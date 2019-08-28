const {TEST_COOKIE_NAME, TOP_LEVEL_OAUTH_COOKIE_NAME} = require('../constants');

module.exports = function withShop({ authBaseUrl } = {}) {
  function shopFromReferrer(referrer) {
    const results = referrer.match(/shop=([^&]+)/) ;
    return results && results[1]
  }
  
  return function verifyRequest(request, response, next) {
    let { query: { shop }, session = {}, baseUrl} = request;

    if (session && session.accessToken && session.shop && session.shop === shop) {
      response.cookie(TOP_LEVEL_OAUTH_COOKIE_NAME);
      next();
      return;
    }

    response.cookie(TEST_COOKIE_NAME, '1');

    if (shop) {
      response.redirect(`${authBaseUrl || baseUrl}/auth?shop=${shop}`);
      return;
    }

    response.redirect('/install');
    return;
  };
};
