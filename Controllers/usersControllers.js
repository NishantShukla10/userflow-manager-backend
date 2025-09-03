const users = require("../models/usersSchema");
const moment = require("moment");
const csv = require("fast-csv");
const fs = require("fs");
const BASE_URL = process.env.BASE_URL;
// const cloudinary = require("../multerconfig/storageConfig"); // ✅ import cloudinary
const cloudinary = require("../config/cloudinary");

exports.userpost = async (req, res) => {
    const { fname, lname, email, mobile, gender, location, status } = req.body;

    if (!fname || !lname || !email || !mobile || !gender || !location || !status || !req.file) {
        return res.status(400).json({ message: "All inputs are required" });
    }

    try {
        const preuser = await users.findOne({ email });
        if (preuser) {
            return res.status(400).json({ message: "This user already exists" });
        }

        const datecreated = new Date();

        // ✅ multer-storage-cloudinary already uploaded to Cloudinary
        const userData = new users({
            fname,
            lname,
            email,
            mobile,
            gender,
            location,
            status,
            profile: req.file.path,         // secure_url from Cloudinary
            profilePublicId: req.file.filename, // public_id from Cloudinary
            datecreated
        });

        await userData.save();
        res.status(201).json(userData);
    } catch (error) {
        console.error("Error in userpost:", error);
        res.status(500).json({ message: "Server error", error });
    }
};

// usersget
exports.userget = async (req, res) => {
    const search = req.query.search || "";
    const gender = req.query.gender;
    const status = req.query.status;
    const sort = req.query.sort || "";
    const page = parseInt(req.query.page) || 1;
    const ITEM_PER_PAGE = 4;

    // Base query: search by fname
    const query = { fname: { $regex: search, $options: "i" } };

    // Apply filters only if provided and not "All"
    if (gender && gender !== "All") {
        query.gender = gender;
    }

    if (status && status !== "All") {
        query.status = status;
    }

    try {
        const skip = (page - 1) * ITEM_PER_PAGE;

        const count = await users.countDocuments(query);

        const usersdata = await users.find(query)
            .sort({ datecreated: sort === "new" ? -1 : 1 }) // newest first if sort=new
            .limit(ITEM_PER_PAGE)
            .skip(skip);

        const pageCount = Math.ceil(count / ITEM_PER_PAGE);

        res.status(200).json({
            Pagination: { count, pageCount },
            usersdata
        });
    } catch (error) {
        console.error("Error in userget:", error);
        res.status(500).json({ message: "Server error", error });
    }
};

// single user get
exports.singleuserget = async (req, res) => {
    const { id } = req.params;

    try {
        const userdata = await users.findOne({ _id: id });
        res.status(200).json(userdata);
    } catch (error) {
        res.status(401).json(error);
    }
};

// USER EDIT
exports.useredit = async (req, res) => {
    const { id } = req.params;
    const { fname, lname, email, mobile, gender, location, status } = req.body;

    const dateUpdated = new Date();

    try {
        const user = await users.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // If a new file is uploaded
        if (req.file) {
            // Delete old image from Cloudinary
            if (user.profilePublicId) {
                try {
                    await cloudinary.uploader.destroy(user.profilePublicId);
                } catch (err) {
                    console.warn("Failed to delete old Cloudinary image:", err.message);
                }
            }

            // Upload new image to Cloudinary
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: "users_profiles",
            });

            user.profile = result.secure_url;
            user.profilePublicId = result.public_id;
        }

        // Update other fields
        user.fname = fname || user.fname;
        user.lname = lname || user.lname;
        user.email = email || user.email;
        user.mobile = mobile || user.mobile;
        user.gender = gender || user.gender;
        user.location = location || user.location;
        user.status = status || user.status;
        user.dateUpdated = dateUpdated;

        await user.save();
        res.status(200).json(user);
    } catch (error) {
        console.error("Error in useredit:", error);
        res.status(500).json({ message: "Server error", error });
    }
};

// DELETE USER
exports.userdelete = async (req, res) => {
    const { id } = req.params;

    try {
        const user = await users.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        // if (user.profilePublicId) {
        //     try {
        //         await cloudinary.uploader.destroy(user.profilePublicId);
        //     } catch (err) {
        //         console.warn("Failed to delete Cloudinary image:", err.message);
        //         // continue deletion even if Cloudinary fails
        //     }
        // }

        await users.findByIdAndDelete(id);
        res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
        console.error("Error in userdelete:", error);
        res.status(500).json({ message: "Server error", error });
    }
};


// change status
exports.userstatus = async (req, res) => {
    const { id } = req.params;
    const { data } = req.body;

    try {
        const userstatusupdate = await users.findByIdAndUpdate(
            { _id: id },
            { status: data },
            { new: true }
        );
        res.status(200).json(userstatusupdate);
    } catch (error) {
        res.status(401).json(error);
    }
};


// // export user
// exports.userExport = async (req, res) => {
//     try {
//         const usersdata = await users.find();

//         const csvStream = csv.format({ headers: true });

//         if (!fs.existsSync("public/files/export/")) {
//             if (!fs.existsSync("public/files")) {
//                 fs.mkdirSync("public/files/");
//             }
//             if (!fs.existsSync("public/files/export")) {
//                 fs.mkdirSync("./public/files/export/");
//             }
//         }

//         const writablestream = fs.createWriteStream(
//             "public/files/export/users.csv"
//         );

//         csvStream.pipe(writablestream);

//         writablestream.on("finish", function () {
//             res.json({
//                 downloadUrl: `${BASE_URL}/files/export/users.csv`,
//             });
//         });
//         if (usersdata.length > 0) {
//             usersdata.map((user) => {
//                 csvStream.write({
//                     FirstName: user.fname ? user.fname : "-",
//                     LastName: user.lname ? user.lname : "-",
//                     Email: user.email ? user.email : "-",
//                     Phone: user.mobile ? user.mobile : "-",
//                     Gender: user.gender ? user.gender : "-",
//                     Status: user.status ? user.status : "-",
//                     Profile: user.profile ? user.profile : "-",
//                     Location: user.location ? user.location : "-",
//                     DateCreated: user.datecreated ? user.datecreated : "-",
//                     DateUpdated: user.dateUpdated ? user.dateUpdated : "-",
//                 })
//             })
//         }
//         csvStream.end();
//         writablestream.end();

//     } catch (error) {
//         res.status(401).json(error)
//     }
// }