const { runWithRequestId, generateRequestId } = require('../utils/logger');

/**
 * 请求ID中间件
 * 为每个请求生成唯一ID，并在整个请求生命周期中传递
 */
function requestIdMiddleware(req, res, next) {
    // 优先使用客户端传递的请求ID，否则生成新的
    const requestId = req.headers['x-request-id'] || generateRequestId();
    
    // 将请求ID附加到请求对象
    req.requestId = requestId;
    
    // 在响应头中返回请求ID
    res.setHeader('X-Request-Id', requestId);
    
    // 使用 AsyncLocalStorage 在整个请求上下文中传递请求ID
    runWithRequestId(requestId, () => {
        next();
    });
}

module.exports = requestIdMiddleware;
