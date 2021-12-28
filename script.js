/*
    HANDLING INPUT
*/

let inputSet = false;

function showImage(image, parent){
    parent.width = image.width;
    parent.height = image.height;
    let context = parent.getContext('2d');
    context.drawImage(image, 0, 0);
}

function clear(){
    let images = document.querySelectorAll(".output img");
    for (let i = 0; i < images.length; i++) {
        images[i].remove();
    }
}

function processInput(){
    const inputFileElement = document.querySelector(".input input[name=file]");
    const fileList = inputFileElement.files;
    const file = fileList[0];
    const inputElement = document.querySelector("#input-canvas");
    const outputElement = document.querySelector("#output-container");

    if (file && file.type.startsWith("image")) {
        const reader = new FileReader();
        reader.onload = function(){
            let image = new Image();
            image.onload = function(){
                showImage(image, inputElement);
                findEdges(image);
            }
            image.src = reader.result;
        }
        reader.readAsDataURL(file);
    }
}

/*
    HANDLING IMAGE
*/

function convoluteVectors(vector, kernel){
        let result = [[]];
        for (let i = 0; i < vector.length; i++) {
            if (i != 0) result.push([]);
            for (let j = 0; j < vector[i].length; j++) {
                result[i].push(0);
            }
        }
        let kernelRows = kernel.length, kernelCols = kernel[0].length;
        let vectorRows = vector.length, vectorCols = vector[0].length;
        let kernelMidX = Math.floor(kernelCols / 2);
        let kernelMidY = Math.floor(kernelRows / 2);
        for (let i = 0; i < vectorRows; i++) {
            for (let j = 0; j < vectorCols; j++) {
                for (let k = 0; k < kernelRows; k++) {
                    let kk = kernelRows - 1 - k;
                    for (let l = 0; l < kernelCols; l++) {
                        let ll = kernelCols - 1 - l;
                        let x, y;
                        y = i + kk - kernelMidY;
                        x = j + ll - kernelMidX;
                        if (y >= 0 && x >= 0 && y < vectorRows && x < vectorCols) result[i][j] += vector[y][x] * kernel[ll][kk];
                    }
                }
            }
        }
        for (let i = 0; i < vectorRows; i++) 
            for (let j = 0; j < vectorCols; j++) {
                result[i][j] = Math.abs(result[i][j]);
        }
        return result;
    }

    function imageDataToVector(imageData){
        let result = [[]];
        for (let i = 0; i < imageData.height; i++) {
            if (i != 0) result.push([]);
            for (let j = 0; j < imageData.width; j++) {
                let value = imageData.data[i * imageData.width * 4 + j * 4];
                result[i].push(value);
            }
        }
        return result;
    }

    function vectorToImageData(vector, imageData){

        for (let i = 0; i < imageData.height; i++) {
            for (let j = 0; j < imageData.width; j++) {
                let value = vector[i][j];
                imageData.data[i * imageData.width * 4 + j * 4] = value;
                imageData.data[i * imageData.width * 4 + j * 4 + 1] = value;
                imageData.data[i * imageData.width * 4 + j * 4 + 2] = value;
                imageData.data[i * imageData.width * 4 + j * 4 + 3] = 255;
            }
        }
    }

    function clamp(value, min, max){
        if (value < min) return min;
        else if (value > max) return max;
        else return value;
    }

    let strongThreshold;
    let weakThreshold;
    let strong;
    let weak;
    function findEdges(image){
        let sobelXKernel = [[1, 0, -1], [2, 0, -2], [1, 0, -1]];
        let sobelYKernel = [[1, 2, 1], [0, 0, 0], [-1, -2, -1]];
        let sigma = document.getElementsByName("sigma")[0].value;
        let gaussianKernel = generateGaussianKernel(5, sigma);

        let context = document.getElementById('input-canvas').getContext('2d');
        let imageData = context.getImageData(0, 0, image.width, image.height);
        grayscale(imageData);
        let vectorData = imageDataToVector(imageData);
        vectorData = convoluteVectors(vectorData, gaussianKernel);
        let sobelX = convoluteVectors(vectorData, sobelXKernel);
        let sobelY = convoluteVectors(vectorData, sobelYKernel);
        vectorData = sobelY;
        let angles = generateAngles(sobelX, sobelY, image.width, image.height);
        vectorData = getAverageData(sobelX, sobelY, image.width, image.height);
        let maxValue = normalize(vectorData, image.width, image.height);
        
        let angleVectorData = newVector(image.width, image.height);
        nonMaximumSupression(angleVectorData, angles, vectorData, image.width, image.height);
        vectorData = angleVectorData;
        
        let strongMultiplier = document.getElementsByName("strong")[0].value;
        let weakMultiplier = document.getElementsByName("weak")[0].value;
        strongThreshold = maxValue * strongMultiplier;
        weakThreshold = strongThreshold * weakMultiplier;
        strong = 255;
        weak = 50;
        doubleThreshold(vectorData, image.width, image.height);
        hysteresis(vectorData, image.width, image.height);
        vectorToImageData(vectorData, imageData);

        displayFinalImage(imageData);
    }
    
    function generateGaussianKernel(size, sigma){
        let result = newVector(size, size);
        for(i = 0; i < size; i++){
            for(j = 0; j < size; j++){
                let k = (size - 1) / 2;
                let x = (i + 1 - (k + 1));
                let y = (j + 1 - (k + 1));
                let exp = -((x * x + y * y) / (2 * sigma * sigma));
                result[i][j] = Math.exp(exp) / ( 2 * Math.PI * sigma * sigma);
            }
        }
        return result;
    }

    function hysteresis(vectorData, imageWidth, imageHeight){
        let dirX = [1, 1, 0, -1, -1, -1, 0, 1];
        let dirY = [0, 1, 1, 1, 0, -1, -1, -1];

        for(i = 1; i < imageHeight - 1; i++){
            for(j = 1; j < imageWidth - 1; j++){
                let value = vectorData[i][j];
                if(value == weak){
                    found = false;
                    for(k = 0; k < 8; k++){
                        newX = i + dirX[k];
                        newY = j + dirY[k];
                        neighbourValue = vectorData[newX][newY];
                        if(neighbourValue == strong){
                            found = true;
                            vectorData[i][j] = strong;
                            break;
                        }
                    }
                    if(!found){
                        vectorData[i][j] = 0;
                    }
                }
            }
        }
    }

    function doubleThreshold(vectorData, imageWidth, imageHeight){
        for(i = 0; i < imageHeight; i++){
            for(j = 0; j < imageWidth; j++){
                let value = vectorData[i][j];
                if(value >= strongThreshold)
                    vectorData[i][j] = strong;
                else if(value >= weakThreshold)
                    vectorData[i][j] = weak;
                else
                    vectorData[i][j] = 0;
            }
        }
    }    

    function nonMaximumSupression(vectorData, angles, originalData, imageWidth, imageHeight){
        for(i = 1; i < imageHeight - 1; i++){
            for(j = 1; j < imageWidth - 1; j++){
                let angle = angles[i][j] * 180 / Math.PI;
                let value = originalData[i][j];
                let firstNeighbour, secondNeighbour;
                if( (angle >= 0 && angle < 22.5) || (angle >= 157.5 && angle <= 180) ){
                    firstNeighbour = originalData[i][j + 1];
                    secondNeighbour = originalData[i][j - 1];
                }
                else if(angle >= 22.5 && angle < 67.5){
                    firstNeighbour = originalData[i - 1][j + 1];
                    secondNeighbour = originalData[i + 1][j - 1];
                }
                else if(angle >= 67.5 && angle < 112.5){
                    firstNeighbour = originalData[i + 1][j];
                    secondNeighbour = originalData[i - 1][j];
                }
                else if(angle >= 112.5 && angle < 157.5){
                    firstNeighbour = originalData[i + 1][j + 1];
                    secondNeighbour = originalData[i - 1][j - 1];
                }
                if(value >= firstNeighbour && value >= secondNeighbour){
                    vectorData[i][j] = value;
                }
            }
        }
    }

    function newVector(width, height, value = 0){
        let result = new Array;
        for(i = 0; i < height; i++){
            result.push([]);
            for(j = 0; j < width; j++){
                result[i].push(value);
            }
        }
        return result;
    }

    function normalize(vectorData, imageWidth, imageHeight){
        let maxValue = 0;
        for(i = 0; i < imageHeight; i++){
            for(j = 0; j < imageWidth; j++){
                maxValue = Math.max(maxValue, vectorData[i][j]);
            }
        }
        for(i = 0; i < imageHeight; i++){
            for(j = 0; j < imageWidth; j++){
               vectorData[i][j] *= 255/maxValue;
            }
        }
        return maxValue;
    }

    function getAverageData(sobelX, sobelY, imageWidth, imageHeight){
        let result = new Array;
        for(i = 0; i < imageHeight; i++){
            result.push([]);
            for(j = 0; j < imageWidth; j++){
                let colorGx = sobelX[i][j];
                let colorGy = sobelY[i][j];
                let G = Math.sqrt(colorGx*colorGx + colorGy*colorGy);
                G = Math.min(255, G);
                result[i].push(G);
            }
        }
        return result;
    }

    function generateAngles(sobelX, sobelY, imageWidth, imageHeight){
        let result = new Array;
        for(i = 0; i < imageHeight; i++){
            result.push([]);
            for(j = 0; j < imageWidth; j++){

                let colorGx = sobelX[i][j];
                let colorGy = sobelY[i][j];
                let angle = Math.atan2(colorGx, colorGy);
                result[i].push(angle);
            }
        }
        return result;
    }

    function grayscale(imageData){
        for(let i = 0; i < imageData.data.length; i += 4){
            let lightness = parseInt(imageData.data[i] * 0.2126 + imageData.data[i + 1] * 0.7152 + imageData.data[i + 2] * 0.0722);
            imageData.data[i] = lightness;
            imageData.data[i + 1] = lightness;
            imageData.data[i + 2] = lightness;
        }
    }

    function displayFinalImage(imageData){
        let canvas = document.getElementById('output-canvas');
        let context = canvas.getContext('2d');
        canvas.width = imageData.width;
        canvas.height = imageData.height;
        context.putImageData(imageData, 0, 0);
    }