function errorHandler(err, req, res, next) {
    console.error('Unhandled Server Error:', err);

    const statusCode = err.statusCode || 500;
    const message = err.isOperational 
        ? err.message 
        : 'An unexpected internal server error occurred. Please try again later.';

    res.status(statusCode).json({
        success: false,
        message: message,
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
}

module.exports = errorHandler;
