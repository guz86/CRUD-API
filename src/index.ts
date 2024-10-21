import http from 'node:http';
import { validate as validateUUID } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 4000;

const users: Array<{ id: string; username: string; age: number; hobbies: string[] }> = [];

const sendResponse = (res: http.ServerResponse, statusCode: number, data: object) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
};

const isValidUUID = (id: string): boolean => {
    return validateUUID(id);
};

const getAllUsers = (res: http.ServerResponse) => {
    sendResponse(res, 200, users);
};

const getUserById = (res: http.ServerResponse, userId: string) => {
    if (!isValidUUID(userId)) {
        sendResponse(res, 400, { message: 'Invalid userId format' });
        return;
    }

    const user = users.find((u) => u.id === userId);

    if (!user) {
        sendResponse(res, 404, { message: `User with id ${userId} not found.` });
    } else {
        sendResponse(res, 200, user);
    }
};

const requestListener = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const urlParts = req.url?.split('/').filter(Boolean);
    const method = req.method;

    if (urlParts && urlParts[0] === 'api' && urlParts[1] === 'users') {
        if (method === 'GET' && urlParts.length === 2) {
            getAllUsers(res);
        }

        else if (method === 'GET' && urlParts.length === 3) {
            const userId = urlParts[2];
            getUserById(res, userId);
        } else {
            sendResponse(res, 404, { message: 'Endpoint not found.' });
        }
    } else {
        sendResponse(res, 404, { message: 'Resource not found.' });
    }
};

const server = http.createServer(requestListener);

server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
