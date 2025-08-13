export const config = {
  timeouts: {
    navigation: 30000,
    networkIdle: 10000,
    defaultWait: 3000,
    quickModeWait: 1000,
  },
  limits: {
    maxResponseBodySize: 50000,
  },
  detection: {
    antiBotDomains: [
      "cloudflare.com",
      "akamai.com",
      "incapsula.com",
      "datadome.co",
      "perimeterx.com",
      "shape.com",
      "imperva.com",
      "sucuri.net",
      "f5.com",
    ],
    captchaDomains: [
      "google.com/recaptcha",
      "hcaptcha.com",
      "cloudflare.com/cdn-cgi/challenge-platform",
      "arkoselabs.com",
      "funcaptcha.com",
      "captcha.net",
      "geetest.com",
      "captcha.luosimao.com",
      "aliyuncs.com/captcha",
      "tencent.com/cap",
    ]
  }
};