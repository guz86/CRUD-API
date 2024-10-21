import http from 'node:http';
import { v4 as uuidv4, validate as validateUUID } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 4000;

interface User {
    id: string;
    name: string;
    age: number;
    hobbies: string[];
}

interface CreateUserRequest {
    name: string;
    age: number;
    hobbies: string[];
}

const users: User[] = [];

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

const createUser = (res: http.ServerResponse, body: CreateUserRequest) => {
    const { name, age, hobbies } = body;

    if (typeof name !== 'string' || name.trim() === '') {
        sendResponse(res, 400, { message: 'Field "name" is required and must be a non-empty string.' });
        return;
    }

    if (typeof age !== 'number' || Number.isNaN(age)) {
        sendResponse(res, 400, { message: 'Field "age" is required and must be a number.' });
        return;
    }

    if (!Array.isArray(hobbies) || !hobbies.every(hobby => typeof hobby === 'string')) {
        sendResponse(res, 400, { message: 'Field "hobbies" is required and must be an array of strings.' });
        return;
    }

    const newUser: User = {
        id: uuidv4(),
        name,
        age,
        hobbies,
    };

    users.push(newUser);
    sendResponse(res, 201, newUser);
};

const updateUser = (res: http.ServerResponse, userId: string, body: Partial<CreateUserRequest>) => {
    if (!isValidUUID(userId)) {
        sendResponse(res, 400, { message: 'Invalid userId format.' });
        return;
    }

    const userIndex = users.findIndex((u) => u.id === userId);

    if (userIndex === -1) {
        sendResponse(res, 404, { message: `User with id ${userId} not found.` });
        return;
    }

    const updatedUser: User = {
        ...users[userIndex],
        ...body,
    };

    users[userIndex] = updatedUser;
    sendResponse(res, 200, updatedUser);
};

const requestListener = (req: http.IncomingMessage, res: http.ServerResponse) => {
    const urlParts = req.url?.split('/').filter(Boolean);
    const method = req.method;

    if (urlParts && urlParts[0] === 'api' && urlParts[1] === 'users') {
        if (method === 'GET' && urlParts.length === 2) {
            getAllUsers(res);
        } else if (method === 'GET' && urlParts.length === 3) {
            const userId = urlParts[2];
            getUserById(res, userId);
        } else if (method === 'POST' && urlParts.length === 2) {
            let body = '';

            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', () => {
                try {
                    const parsedBody: CreateUserRequest = JSON.parse(body);
                    createUser(res, parsedBody);
                } catch (error) {
                    sendResponse(res, 400, { message: 'Invalid JSON format.' });
                }
            });
        } else if (method === 'PUT' && urlParts.length === 3) {
            const userId = urlParts[2];
            let body = '';

            req.on('data', chunk => {
                body += chunk.toString();
            });

            req.on('end', () => {
                try {
                    const parsedBody: Partial<CreateUserRequest> = JSON.parse(body);
                    updateUser(res, userId, parsedBody);
                } catch (error) {
                    sendResponse(res, 400, { message: 'Invalid JSON format.' });
                }
            });
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
