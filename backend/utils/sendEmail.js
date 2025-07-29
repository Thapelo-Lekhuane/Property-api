const sendEmail = async (options) => {
  // Mock implementation for testing
  return new Promise((resolve) => {
    console.log(`Mock email sent to: ${options.email}`);
    console.log(`Subject: ${options.subject}`);
    console.log(`Message: ${options.message}`);
    resolve();
  });
};

module.exports = sendEmail;
