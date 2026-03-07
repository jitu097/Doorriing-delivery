const formatResponse = (data, message = 'success') => ({
  success: true,
  message,
  data
});

const formatError = (message = 'Something went wrong', details = null) => ({
  success: false,
  message,
  details
});

module.exports = { formatResponse, formatError };
