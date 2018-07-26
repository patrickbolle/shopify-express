const querystring = require('querystring');
const crypto = require('crypto');
const fetch = require('node-fetch');
const http = require('http');

module.exports = function createShopifyAuthRoutes({
  host,
  apiKey,
  secret,
  scope,
  afterAuth,
  shopStore,
  accessMode,
}) {
  return {
    // This function initializes the Shopify OAuth Process
    auth(request, response) {
      const { query, baseUrl } = request;
      const { shop } = query;

      if (shop == null) {
        return response.status(400).send('Expected a shop query parameter');
      }

      const redirectTo = `https://${shop}/admin/oauth/authorize`;

      const redirectParams = {
        baseUrl,
        scope,
        client_id: apiKey,
        redirect_uri: `${host}${baseUrl}/callback`,
      };

      if (accessMode === 'online') {
        redirectParams['grant_options[]'] = 'per-user';
      }

      response.send(
        `<!DOCTYPE html>
        <html>
          <head>
            <script type="text/javascript">
              window.top.location.href = "${redirectTo}?${querystring.stringify(redirectParams)}"
            </script>
          </head>
        </html>`,
      );
    },

    // Users are redirected here after clicking `Install`.
    // The redirect from Shopify contains the authorization_code query parameter,
    // which the app exchanges for an access token
    async callback(request, response) {

      const { query } = request;
      const { code, hmac, shop } = query;

      const map = JSON.parse(JSON.stringify(query));
      delete map['signature'];
      delete map['hmac'];

      const message = querystring.stringify(map);
      const generated_hash = crypto
        .createHmac('sha256', secret)
        .update(message)
        .digest('hex');

      if (generated_hash !== hmac) {
        return response.status(400).send('HMAC validation failed');
      }

      if (shop == null) {
        return response.status(400).send('Expected a shop query parameter');
      }

      const requestBody = querystring.stringify({
        code,
        client_id: apiKey,
        client_secret: secret,
      });

      const remoteResponse = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(requestBody),
        },
        body: requestBody,
      });

      const responseBody = await remoteResponse.json();

      console.log("Response Body: " + responseBody);
      console.log(responseBody);

      const accessToken = responseBody.access_token;

      const shopInfo = {
        code: query.code,
        hmac: query.hmac,
        shop: query.shop,
        timestamp: query.timestamp,
        accessToken: accessToken
      };

      // console.log(query);
      // console.log(accessToken);
      // console.log('shop info' + JSON.stringify(shopInfo));

      fetch('https://app.wait.li/shop', { 
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify(shopInfo),
        headers: {"Content-Type": "application/json"}
      })
      .then(res => {
        console.log(res.status);
        // return res.json();
        if (res.status == 400) {
          console.log('Shop is already in the database');
          storeShopFun('already-complete');
        } else if (res.status == 200) {
          console.log('Shop was just installed');
          storeShopFun('not-complete');
        }
      });

      function storeShopFun(status) {
        console.log(status);
        shopStore.storeShop({ accessToken, shop, status }, (err, token) => {
          if (err) {
            console.error('🔴 Error storing shop access token', err);
          }
  
          if (request.session) {
            request.session.accessToken = accessToken;
            request.session.shop = shop;
            request.session.status = status;
            console.log(accessToken + ' ' + shop + ' ' + status);
          } else {
            console.warn('Session not present on request, please install a session middleware.');
          }
          afterAuth(request, response);
        });
      }
      
    }
  };
};
