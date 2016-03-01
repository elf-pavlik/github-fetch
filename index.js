/* jshint asi: true */

var request = require('then-request')
var uriTemplates = require('uri-templates')
var _ = require('lodash')

var api =  {
  maxPageSize: 100,
  templates: {
    collection: "?per_page={items}",
    paging: "?per_page={items}&page={page}"
  }
}

// '<https://api.github.com/user/876431/followers?per_page=100&page=2> rel="next", <https://api.github.com/user/876431/followers?per_page=100&page=2> rel="last"'
function parseNumberOfPages(response) {
  if(response.headers.link) {
    //and matches rel="last"
    return Number(response.headers.link.match(/.*page=(.*)>; rel="last"/)[1])
  } else {
    return 1
  }
}

function fetchResource(url, options) {
  return request('GET', url, options)
    .then(function(res) {
      if(res.statusCode === 200) {
        return res.body.toString()
      } else {
        return Promise.reject(res.body.toString())
      }
    })
}

function fetchCollection(url, numberOfPages, options) {
  return Promise.all(_.range(1, numberOfPages + 1).map(function(index) {
    var tmpl = uriTemplates(api.templates.paging)
    var pageUrl = url + tmpl.fill({ items: api.maxPageSize, page: index })
    return request('GET', pageUrl, options)
      .then(function(res) {
        if (res.statusCode === 200) return JSON.parse(res.body.toString())
        else return Promise.reject(res.body.toString())
      })
  })).then(function(data) {
    return JSON.stringify(_.flatten(data))
  })
}

module.exports = function (url, options) {
  var opt = {
    headers: {
      'User-Agent': 'https://github.com/then/then-request'
    }
  }
  if(options && options.token) {
    opt.headers['Authorization'] = "token " + options.token
  }
  var template = uriTemplates(api.templates.collection)
  return request('HEAD', url + template.fill({ items: api.maxPageSize }), opt)
    .then(function(res) {
      var numberOfPages = parseNumberOfPages(res)
      if( numberOfPages > 1) {
        return fetchCollection(url, numberOfPages, opt)
      } else {
        return fetchResource(url, opt)
      }
    })
}
