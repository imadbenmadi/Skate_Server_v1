const { Users } = require("../../models/Database");
const nodemailer = require("nodemailer");
const dns = require("dns");
const crypto = require("crypto");
const generateVerificationCode = () => {
    const code = crypto.randomInt(10000000, 99999999);
    return code.toString();
};

const sendVerificationEmail = (Email, verificationToken) => {
    let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL, // Your Gmail email address
            pass: process.env.PASSWORD, // Your Gmail password
        },
    });
    const htmlTemplate = `
        <html>
            <head>
                <style>
                    body {
                        font-family: Arial, sans-serif;
                        background-color: #f5f5f5;
                        padding: 20px;
                    }
                    .container {
                        max-width: 600px;
                        margin: 0 auto;
                        background-color: #ffffff;
                        border-radius: 10px;
                        padding: 20px;
                        box-shadow: 0px 2px 5px rgba(0, 0, 0, 0.1);
                    }
                    h1 {
                        color: #333333;
                        text-align: center;
                    }
                    p {
                        color: #666666;
                    }
                    .verification-code {
                        background-color: #f2f2f2;
                        padding: 10px;
                        border-radius: 5px;
                        text-align: center;
                        font-size: 20px;
                        margin-top: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>Verification Email</h1>
                    <p>Thank you for registering. Please use the following verification code to complete your registration:</p>
                    <div class="verification-code">${verificationToken}</div>
                </div>
            </body>
        </html>
    `;
    transporter.sendMail(
        {
            from: process.env.EMAIL,
            to: Email,
            subject: "Skate Email verification",
            html: htmlTemplate,
        },
        (err, info) => {
            if (err) {
                console.error("Failed to send email:", err);
                return;
            }
            console.log("Email sent:", info.messageId);
        }
    );
};

const isEmailValid = (Email) => {
    return new Promise((resolve, reject) => {
        const domain = Email.split("@")[1];
        console.log(domain);
        dns.resolve(domain, "MX", (err, addresses) => {
            if (err || !addresses || addresses.length === 0) {
                resolve(false); // No MX records found, domain is invalid
            } else {
                // Additional check for A or AAAA records to further validate domain existence
                dns.resolve(domain, (err, addresses) => {
                    if (err || !addresses || addresses.length === 0) {
                        resolve(false); // No A or AAAA records found, domain is invalid
                    } else {
                        resolve(true); // Domain is valid
                    }
                });
            }
        });
    });
};

const handleRegister = async (req, res) => {
    try {
        const { FirstName, LastName, Email, Password, Age, Gender, Telephone } =
            req.body;

        const isValidTelephone = /^(0)(5|6|7)[0-9]{8}$/.test(Telephone);

        if (
            !FirstName ||
            !LastName ||
            !Email ||
            !Password ||
            !Gender ||
            !Telephone
        ) {
            return res.status(409).json({ message: "Missing Data" });
        } else if (Password.length < 8) {
            return res
                .status(409)
                .json({ error: "Password must be at least 8 characters" });
        } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(Email)) {
            return res.status(409).json({ error: "Invalid Email" });
        } else if (Gender !== "male" && Gender !== "female") {
            return res.status(409).json({
                error: "Invalid Gender, accepted values: male or female",
            });
        } else if (Telephone.length < 9) {
            return res
                .status(409)
                .json({ error: "Telephone must be at least 9 characters" });
        } else if (!isValidTelephone) {
            return res
                .status(409)
                .json({ error: "Telephone must be a number" });
        } else if (Age && isNaN(Age)) {
            return res.status(409).json({ error: "Age must be a number" });
        }

        if (!(await isEmailValid(Email))) {
            return res.status(409).json({ error: "Invalid email domain" });
        }

        const existingUser = await Users.findOne({ Email: Email });
        if (existingUser) {
            return res.status(401).json({ error: "Email already exists" });
        }

        const verificationToken = generateVerificationCode();
        const newUser = new Users({
            FirstName: FirstName,
            LastName: LastName,
            Email: Email,
            Telephone: Telephone,
            Password: Password,
            Age: Age,
            Gender: Gender,
            EmailVerificationToken: verificationToken,
        });

        await newUser.save();
        sendVerificationEmail(Email, verificationToken);
        res.status(200).json({ message: "Account Created Successfully" });
    } catch (err) {
        res.status(400).json({ err });
    }
};

module.exports = { handleRegister };
