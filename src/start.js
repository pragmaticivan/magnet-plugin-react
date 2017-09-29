import express from 'express';
import path from 'path';

const reactDirectory = '.magnet/react';

let isServingReactFiles = false;

const serveReactFilesOnce = (magnet, outputDirectory) => {
  if (!isServingReactFiles) {
    magnet.getServer()
      .getEngine()
      .use('/.react', express.static(outputDirectory));
  }
  isServingReactFiles = true;
};

export default async (magnet) => {
  let directory = magnet.getDirectory();
  let outputDirectory = path.join(directory, reactDirectory);
  serveReactFilesOnce(magnet, outputDirectory);
};
