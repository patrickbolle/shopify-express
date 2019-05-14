module.exports = function withShop({ authBaseUrl } = {}) {
  function shopFromReferrer(referrer) {
    const results = referrer.match(/shop=([^&]+)/) ;
    return results && results[1]
  }
  
  return function verifyRequest(request, response, next) {
    let { query: { shop }, session = {}, baseUrl} = request;

    if (shop === undefined && session.shop) {
      shop = session.shop
    }

    if (!shop && request.get('referer')) {
      shop = shopFromReferrer(request.get('referrer')) || session.shop;
    }

    if (session && session.accessToken && session.shop && session.shop === shop) {
      next();
      return;
    }

    if (shop) {
      response.redirect(`${authBaseUrl || baseUrl}/auth?shop=${shop}`);
      return;
    }

    response.redirect('/install');
    return;
  };
};
