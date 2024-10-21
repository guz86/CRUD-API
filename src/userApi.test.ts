import http from 'node:http';
import { IncomingMessage } from 'node:http';

const PORT = 4000;

const sendRequest = (method: string, path: string, body?: object): Promise<any> => {
    return new Promise((resolve, reject) => {
        const req = http.request({ hostname: 'localhost', port: PORT, path, method, headers: { 'Content-Type': 'application/json' } }, (res: IncomingMessage) => {
            let data = '';
            res.on('data', chunk => {
                data += chunk;
            });
            res.on('end', () => {
                resolve({ statusCode: res.statusCode, body: JSON.parse(data || '{}') });
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (body) {
            req.write(JSON.stringify(body));
        }
        req.end();
    });
};

describe('User API', () => {
    let userId: string;

    beforeAll(async () => {
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    test('Get all users - empty array expected', async () => {
        try {
            const response = await sendRequest('GET', '/api/users');
            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual([]);
        } catch (error) {
            console.error('Error in Get all users:', error);
        }
    });

    test('Create a new user', async () => {
        try {
            const newUser = { name: 'John Doe', age: 30, hobbies: ['reading', 'sports'] };
            const response = await sendRequest('POST', '/api/users', newUser);
            expect(response.statusCode).toBe(201);
            expect(response.body).toHaveProperty('id');
            expect(response.body.name).toBe(newUser.name);
            expect(response.body.age).toBe(newUser.age);
            expect(response.body.hobbies).toEqual(newUser.hobbies);
            userId = response.body.id;
        } catch (error) {
            console.error('Error in Create a new user:', error);
        }
    });

    test('Get user by id', async () => {
        try {
            const response = await sendRequest('GET', `/api/users/${userId}`);
            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('id', userId);
            expect(response.body.name).toBe('John Doe');
        } catch (error) {
            console.error('Error in Get user by id:', error);
        }
    });

    test('Update the created user', async () => {
        try {
            const updatedData = { name: 'Jane Doe', age: 31 };
            const response = await sendRequest('PUT', `/api/users/${userId}`, updatedData);
            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('id', userId);
            expect(response.body.name).toBe(updatedData.name);
            expect(response.body.age).toBe(updatedData.age);
        } catch (error) {
            console.error('Error in Update the created user:', error);
        }
    });

    test('Delete the created user', async () => {
        try {
            const response = await sendRequest('DELETE', `/api/users/${userId}`);
            expect(response.statusCode).toBe(204);
        } catch (error) {
            console.error('Error in Delete the created user:', error);
        }
    });

    test('Get deleted user - not found', async () => {
        try {
            const response = await sendRequest('GET', `/api/users/${userId}`);
            expect(response.statusCode).toBe(404);
            expect(response.body).toEqual({ message: `User with id ${userId} not found.` });
        } catch (error) {
            console.error('Error in Get deleted user - not found:', error);
        }
    });
});
