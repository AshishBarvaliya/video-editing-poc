const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const multer = require("multer");
const concat = require("ffmpeg-concat");
const glob = require("glob");
const ffmpegPath = require("@ffmpeg-installer/ffmpeg").path;
const ffmpeg = require("fluent-ffmpeg");
ffmpeg.setFfmpegPath(ffmpegPath);

let list = "";

const listFilePath = "public/uploads/" + Date.now() + "list.txt";

const outputFileName = Date.now() + "output.mp4";

const app = express();

const dir = "public";
const subDirectory = "public/uploads";

if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir);

  fs.mkdirSync(subDirectory);
}
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "public/uploads");
  },
  filename: function (req, file, cb) {
    cb(
      null,
      file.fieldname + "-" + Date.now() + path.extname(file.originalname)
    );
  },
});

const videoFilter = function (req, file, cb) {
  // Accept videos only
  if (!file.originalname.toLowerCase().match(/\.(mp4|mov)$/)) {
    req.fileValidationError = "Only video files are allowed!";
    return cb(new Error("Only video files are allowed!"), false);
  }
  cb(null, true);
};

var upload = multer({ storage: storage, fileFilter: videoFilter });

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 4000;
console.log("__dirname", __dirname);
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/src/index.html");
});

app.post("/merge", upload.array("files", 1000), async (req, res) => {
  if (!req.files) {
    res.send(400).json({ message: "No files found!" });
    return;
  }
  list = "";
  req.files.forEach((file) => {
    list += `file ${file.filename}`;
    list += "\n";
  });

  var writeStream = fs.createWriteStream(listFilePath);

  writeStream.write(list);

  writeStream.end();

  const videos = glob.sync("public/uploads/*.mp4");

  await concat({
    output: outputFileName,
    videos,
    transition: {
      name: "fadegrayscale",
      duration: 500,
    },
  });

  console.log("videos are successfully merged");

  res
    .status(200)
    .sendFile(path.join(__dirname + `/${outputFileName}`), function (err) {
      if (err) throw err;
      req.files.forEach((file) => {
        fs.unlinkSync(file.path);
      });

      fs.unlinkSync(listFilePath);
      fs.unlinkSync(outputFileName);
    });
});

app.post("/trim", upload.array("files", 1), (req, res) => {
  if (!req.files) {
    res.send(400).json({ message: "No files found!" });
    return;
  }

  const videos = glob.sync("public/uploads/*.mp4");

  ffmpeg(videos[0])
    .setStartTime("00:00:05")
    .setDuration(5)
    .output(outputFileName)
    .on("end", function (err) {
      if (!err) {
        console.log("video is trimmed successfully");

        res
          .status(200)
          .sendFile(
            path.join(__dirname + `/${outputFileName}`),
            function (err) {
              if (err) throw err;
              req.files.forEach((file) => {
                fs.unlinkSync(file.path);
              });

              fs.unlinkSync(outputFileName);
            }
          );
      }
    })
    .on("error", function (err) {
      console.log("error: ", err);
    })
    .run();
});

app.post("/thumbnail", upload.array("files", 1), (req, res) => {});

app.listen(PORT, () => {
  console.log(`App is listening on Port ${PORT}`);
});
