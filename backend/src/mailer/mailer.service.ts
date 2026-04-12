import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailerService {
    private transporter: nodemailer.Transporter;

    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: 'juliustolentino.diamond@gmail.com',
                pass: 'jlwkmqmfqwginxqz '
            }
        });
    }

    async sendInvitation(email: string, fullName: string, username: string, token: string) {
        const inviteLink = `http://localhost:5173/setup-password?token=${token}`;

        const mailOptions = {
            from: '"LMS Admin" <juliustolentino.diamond@gmail.com>',
            to: email,
            subject: 'Activate your LMS Account',
            html: `
                <div style="font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #4f46e5;">Welcome, ${fullName}!</h2>
                    <p>Your academic account has been successfully created.</p>
                    
                    <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 20px 0;">
                        <p style="margin: 0 0 5px 0; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: bold;">Your System Username</p>
                        <p style="margin: 0; font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: 0.02em;">${username}</p>
                    </div>

                    <p style="color: #334155;">To securely access your portal, please set up your password by clicking the button below:</p>
                    
                    <a href="${inviteLink}" style="display: inline-block; padding: 12px 24px; background: #4f46e5; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; margin-top: 10px;">Set Password & Activate</a>
                    
                    <p style="margin-top: 30px; color: #94a3b8; font-size: 12px; line-height: 1.5;">If the button doesn't work, copy and paste this secure link into your browser:<br/>${inviteLink}</p>
                </div>
            `
        };

        try {
            const result = await this.transporter.sendMail(mailOptions);
            return result;
        } catch (error) {
            console.error('Nodemailer Error:', error);
            throw error;
        }
    }
}
