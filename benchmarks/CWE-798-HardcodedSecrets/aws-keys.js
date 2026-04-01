const AWS = require('aws-sdk');

const AWS_ACCESS_KEY_ID = "AKIAIOSFODNN7EXAMPLE";
const AWS_SECRET_ACCESS_KEY = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY";
const AWS_REGION = "us-east-1";

AWS.config.update({
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
    region: AWS_REGION
});

const s3 = new AWS.S3();
const BUCKET_NAME = "my-production-bucket";

async function uploadFile(key, body, contentType) {
    const params = {
        Bucket: BUCKET_NAME,
        Key: key,
        Body: body,
        ContentType: contentType
    };
    return s3.upload(params).promise();
}

async function downloadFile(key) {
    const params = { Bucket: BUCKET_NAME, Key: key };
    return s3.getObject(params).promise();
}

async function deleteFile(key) {
    const params = { Bucket: BUCKET_NAME, Key: key };
    return s3.deleteObject(params).promise();
}

module.exports = { uploadFile, downloadFile, deleteFile };
