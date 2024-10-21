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

const validateUserData = (data: CreateUserRequest): boolean => {
    const { name, age, hobbies } = data;

    if (typeof name !== 'string' || name.trim() === '') {
        return false;
    }
    if (typeof age !== 'number' || Number.isNaN(age)) {
        return false;
    }
    if (!Array.isArray(hobbies) || !hobbies.every(hobby => typeof hobby === 'string')) {
        return false;
    }
    return true;
};

const createUser = (res: http.ServerResponse, body: CreateUserRequest) => {
    if (!validateUserData(body)) {
        sendResponse(res, 400, { message: 'Invalid user data.' });
        return;
    }

    const newUser: User = {
        id: uuidv4(),
        name: body.name,
        age: body.age,
        hobbies: body.hobbies,
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

const deleteUser = (res: http.ServerResponse, userId: string) => {
    if (!isValidUUID(userId)) {
        sendResponse(res, 400, { message: 'Invalid userId format.' });
        return;
    }

    const userIndex = users.findIndex((u) => u.id === userId);
    if (userIndex === -1) {
        sendResponse(res, 404, { message: `User with id ${userId} not found.` });
        return;
    }

    users.splice(userIndex, 1);
    sendResponse(res, 204, {});
};

const parseRequestBody = (req: http.IncomingMessage, res: http.ServerResponse, callback: (body: any) => void) => {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString();
    });

    req.on('end', () => {
        try {
            const parsedBody = JSON.parse(body);
            callback(parsedBody);
        } catch (error) {
            sendResponse(res, 400, { message: 'Invalid JSON format.' });
        }
    });
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
            parseRequestBody(req, res, (parsedBody: CreateUserRequest) => createUser(res, parsedBody));
        } else if (method === 'PUT' && urlParts.length === 3) {
            const userId = urlParts[2];
            parseRequestBody(req, res, (parsedBody: Partial<CreateUserRequest>) => updateUser(res, userId, parsedBody));
        } else if (method === 'DELETE' && urlParts.length === 3) {
            const userId = urlParts[2];
            deleteUser(res, userId);
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
