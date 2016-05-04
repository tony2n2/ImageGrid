/**
 * The script unfortunately cannot generate the imageGrids that are identical to
 * one given in the example pdf file. There are no clear rules defined for the
 * layout, and thus can only be derived from the layout in the example file.
 * There seems to be ambiguity with how some images should be placed, should ask
 * the designer for clarification.
 *
 * Further improvements:
 * - the 3d representation of the grids can be wraped around by a object and
 * 		only exposing limited legal operations.
 * - only load the grids that are visible or will become visible, can save some
 * 		resources.
 * - A script for converting vertical mousewheel scroll to horizontal. To scroll
 * 		horizontally now, shift must be hold pressed while scrolling.
 * - Cover the code with test cases, applicable only if this piece of code will
 *    have any real world usefulness...
 * - Although the owner tried his best to adhere to the Blendle's js styleguide,
 * 		due to his lack of experience with javascript there are definitely things
 * 		overlooked.
 */

/**
  * imageGrid - The process is seperated into two major steps:
  * 1. Planning the layout and choosing the right image quality.
  * 2. Present the grid onto the browser.
  *
  * Additionally, there is a dedicated object, ImageProvider, which acts as a
  * repository for the images. It is responsible for retrieving all kinds of
  * info about the images.
  *
  * @param  {[]} argImages      The images from the Json source converted to []
  * @param  {Int} argColumns     Number of columns per grid
  * @param  {Int} argRows        Number of rows per grid
  * @param  {Int} argGridWidth   Width of a grid
  * @param  {Int} argGrindHeight Height of a grid
  */
 function imageGrid(argImages, argColumns, argRows, argGridWidth, argGrindHeight) {
   const cImageGapSize = 6;
   const cGridGapSize = 20;

   if (argImages === undefined || argImages.length === 0) {
     console.log('Image source empty');
     return;
   }
   var provider = ImageProvider(argImages);

   var gridPlanner = ImageGridPlanner(provider, argColumns, argRows, argGridWidth, argGrindHeight, cImageGapSize);
   const grids = gridPlanner.plan();

   if (grids === undefined) {
     console.log('grids planning failed');
     return;
   }

  //  Uncomment to see the array representation in the console log.
   debugGrid(grids);

   var presenter = ImageGridPresenter(grids, provider, argColumns, argRows, argGridWidth, argGrindHeight, cImageGapSize, cGridGapSize);
   presenter.showGrids();
 }

/**
 * ImageGridPlanner - The object responsible for planning the layout of all
 * images. The images are retrived in order through the ImageProvider object.
 * The resulting plan is representated by a 3d array which can be visualized in
 * the console with the debugGrid(grids) function.
 *
 * @param  {ImageProvider} argImageProvider A reference to the ImageProvider
 * @param  {Int} argColumns       Number of columns in a grid
 * @param  {Int} argRows          Number of rows in a grid
 * @param  {Int} argGridWidth     Width of a single grid
 * @param  {Int} argGridHeight    Height of a single grid
 * @param  {Int} argGapSpace      Space between two images in a grid
 */
function ImageGridPlanner(argImageProvider, argColumns, argRows, argGridWidth, argGridHeight, argGapSpace) {
  const cImageProvider = argImageProvider;
  const cColumns = argColumns;
  const cRows = argRows;
  const cGridWidth = argGridWidth;
  const cGridHeight = argGridHeight;
  const cGapSpace = argGapSpace;

  // Width and height of a single tile in a grid.
  const cTileWidth = Math.round(argGridWidth / argColumns);
  const cTileHeight = Math.round(argGridHeight / argRows);

  /**
   * getAllSizes - Given the size of a column or row and the space between two
   * tiles and the available columns or rows, calulates the coresponding
   * possible size for the image. This is size is then used to find the most
   * suitable image quality to load.
   *
   * @param  {Int} unitSize     size of a single column or row
   * @param  {Int} maxUnitCount available number of columns or rows
   * @param  {Int} gapSize      space between two tiles
   * @return {[]}              the array containing the possible sizes
   */
  function getAllSizes(unitSize, maxUnitCount, gapSize) {
    var stepSize = unitSize;
    var resultArray = [];
    resultArray['sizes'] = [];
    resultArray['unit'] = [];
    resultArray['sizes'].push(unitSize);
    resultArray['unit'].push(1);
    for (var i = 0; i < maxUnitCount - 1; i++) {
      stepSize += (unitSize + gapSize);
      resultArray['sizes'].push(stepSize);
      resultArray['unit'].push(i + 2);
    }
    return resultArray;
  };

  /**
   * planForCurrentImage - Tiles to be covered by the image that is currently
   * pointed by the ImageProvider object. Tiles that are still available can be
   * calculated based on the given starting position. Then the most suitable
   * image quality is retrieved from the ImageProvider.
   *
   * @param  {Int} colIndex column index of the starting position
   * @param  {Int} rowIndex row index of the starting position
   * @return {Tile}  A Tile object containing the imageId, quality and the
   *                   number of columns and rows taken up by the image.
   */
  function planForCurrentImage(availableColumns, availableRows, forced) {
    var widthSizes = getAllSizes(cTileWidth, availableColumns, cGapSpace);
    var heightSizes = getAllSizes(cTileHeight, availableRows, cGapSpace);

    // if its forced to fit image in the supplied column and row number, then
    // only keep the maximal size.
    if (forced) {
      widthSizes = {sizes: [widthSizes['sizes'][widthSizes['sizes'].length - 1]],
                    unit: [widthSizes['unit'][widthSizes['sizes'].length - 1]]};
      heightSizes = {sizes: [heightSizes['sizes'][heightSizes['sizes'].length - 1]],
                    unit: [heightSizes['unit'][heightSizes['sizes'].length - 1]]};
    }

    var bestFitImage;
    var widthId = widthSizes['sizes'].length - 1;
    var heightId = heightSizes['sizes'].length - 1;
    var tilePortrait, imagePortrait, forcedToChoose, weightedSum;
    while (!bestFitImage) {

      var tileRatio = widthSizes['sizes'][widthId] / heightSizes['sizes'][heightId];

      // 3 variables to consider when choosing the apropriate image quality
      //  1. ratio of the available tiles
      //  2. ratio of the image
      //  3. if the width and height is forced
      // results is 2^3 = 8 possible situation:
      //
      //     tiles       |    image      | forcedToChoose  |   quality
      //   -----------------------------------------------------------------
      //    4 portrait      2 portrait        1 no            7 byHeight
      //    4 portrait      2 portrait        0 yes           6 byHeight
      //    4 portrait      0 landscape       1 no            5 byWidth
      //    4 portrait      0 landscape       0 yes           4 byHeight
      //    0 landscape     2 portrait        1 no            3 byHeight
      //    0 landscape     2 portrait        0 yes           2 byWidth
      //    0 landscape     0 landscape       1 no            1 byWidth
      //    0 landscape     0 landscape       0 yes           0 byWidth
      //
      tileIsPortrait = (tileRatio < 1 ? 4 : 0);
      imageIsPortrait = (cImageProvider.isPortrait() ? 2 : 0);
      forcedToChoose = ((widthId > 0 && heightId > 0) ? 1 : 0);

      weightedSum = tileIsPortrait + imageIsPortrait + forcedToChoose;

      switch (weightedSum) {
        case 7:
        case 6:
        case 4:
        case 3:
          bestFitImage = cImageProvider.getBestFitImageQualityByHeight(heightSizes['sizes'][heightId], forcedToChoose);
          if (!bestFitImage) {
            widthId--;
          }
        break;
        case 5:
        case 2:
        case 1:
        case 0:
          bestFitImage = cImageProvider.getBestFitImageQualityByWidth(widthSizes['sizes'][widthId], forcedToChoose);
          if (!bestFitImage) {
            heightId--;
          }
        break;
      }
    }
    if (bestFitImage) {
      scale = Math.round(bestFitImage.getWidth() / widthSizes['sizes'][widthId] * 100) / 100;
    }

    for (var j = heightSizes['sizes'].length - 1; j >= 0; j--) {
      if (Math.round(bestFitImage.getHeight() / scale) > heightSizes['sizes'][j] || j === 0) {
        break;
      }
    }
    return {image: bestFitImage, colsTaken: widthSizes['unit'][widthId], rowsTaken: heightSizes['unit'][j]};
  };

  /**
   * planForThisGrid - this function computes the layout of a single grid with
   * images retrieved from the ImageProvider.
   * A single grid is a 2-d array of tiles. If the image takes up multiple
   * tiles, then the info about that image is stored in the upper-left most tile
   * that is taken by that image. A placeholder with a pointer to the upper-left
   * most tile is stored in all other tile of the same image.
   *
   */
  function planForAGrid() {
    var resultArray, tile, rowsTaken, colsTaken;
    var gridLayout = [];
    for (var colIndex = 0; colIndex<cColumns; colIndex++) {
      gridLayout.push(new Array(cRows));
    }
    for (var colId = 0; colId<cColumns; colId++) {
      for (var rowId = 0; rowId<cRows; rowId++) {
        if (gridLayout[colId][rowId] === undefined ||
           !gridLayout[colId][rowId].isPlaceHolder()) {
          if (cImageProvider.hasCurrent()) {
            resultArray = planForCurrentImage(cColumns - colId, cRows - rowId, false);
            tile = ImageTile(resultArray['image'], resultArray['rowsTaken'], resultArray['colsTaken'], colId, rowId);

            addImageTileToGrid(gridLayout, tile);
            cImageProvider.moveToNext();
          } else {
            gridLayout[colId][rowId] = PlaceHolder(undefined);
          }
        }
      }
    }
    return gridLayout;
  }

  /**
   * findTopLeftEmptyTile - This function finds the top left most empty tile,
   * if exist, that is not covered by any image.
   *
   * @param  {[][]}       lastGrid empty tile can only occur in the last grid.
   * @return {array(2)}   Coordinate of the tile, if found. Undefined, if not found.
   */
  function findTopLeftEmptyTile(lastGrid) {
    if (lastGrid.length === 0) {
      return undefined;
    }
    const lastColumn = lastGrid[lastGrid.length - 1];
    // walk from top of the last column to find the top most empty tile.
    for (var rowIndex = 0; rowIndex < lastColumn.length; rowIndex++) {
      if (lastColumn[rowIndex].isEmptyPlaceHolder()) {
        // if empty tile is found, then walk left to find the left most empty tile.
        for (var colIndex = lastGrid.length - 1; colIndex >= 1; colIndex--) {
          if (!lastGrid[colIndex - 1][rowIndex].isEmptyPlaceHolder()) {
            return {colId: colIndex, rowId: rowIndex};
          }
        }
        return {colId: colIndex, rowId: rowIndex};
      }
    }
    return undefined;
  }

  /**
   * addImageTileToGrid - description
   *
   * @param  {type} grid      description
   * @param  {type} imageTile description
   * @return {type}           description
   */
  function addImageTileToGrid(grid, imageTile) {
    // Tiles covered by the same image is reserved with a PlaceHolder object.
    const colId = imageTile.getColId();
    const rowId = imageTile.getRowId();
    const colsTaken = imageTile.getColsTaken();
    const rowsTaken = imageTile.getRowsTaken();
    for (var tileColId = 0; tileColId<colsTaken; tileColId++) {
      for (var tileRowId = 0; tileRowId<rowsTaken; tileRowId++) {
        grid[colId + tileColId][rowId + tileRowId] = PlaceHolder(imageTile);
      }
    }

    // The top left most tile of the image holds the info about the image.
    grid[colId][rowId] = imageTile;
  }

  /**
   * refreshImageGrid - Expand the image in the grid representation
   *
   * @param  {[][]} grid            The grid
   * @param  {ImageTile} imageTile  The image
   * @param  {Int} rowsToFill       Number of rows to expand
   * @param  {Int} colsToFill       Number of columns to expand
   */
  function expandImageGrid(grid, imageTile, argRowsToFill, argColsToFill) {
    var tile;
    var rowsToCover = imageTile.getRowsTaken() + (argRowsToFill ? argRowsToFill : 0);
    var colsToCover = imageTile.getColsTaken() + (argColsToFill ? argColsToFill : 0);
    if (!imageTile.getImage().isHighestQuality()) {
      cImageProvider.setCurrentId(imageTile.getImage().getImageId());
      console.log('image replan, quality not highest, rowToCover: ' + rowsToCover + ' colsToCover: ' + colsToCover);
      var resultArray = planForCurrentImage(colsToCover, rowsToCover, true);
      tile = ImageTile(resultArray['image'],resultArray['rowsTaken'],
        resultArray['colsTaken'], imageTile.getColId(), imageTile.getRowId());
    } else {
      tile = ImageTile(imageTile.getImage(),rowsToCover, colsToCover, imageTile.getColId(), imageTile.getRowId());
    }
    addImageTileToGrid(grid, tile);
  }

  function findAndFixEmptySpace(grids) {
    var lastGrid = grids[grids.length - 1];
    // the coordinate of the top left most empty tile
    var emptyTileCoordinate;

    // This is very long while-loop. The loop breaks only if there are no empty
    // spaces found in the last grid.
    while ((emptyTileCoordinate = findTopLeftEmptyTile(lastGrid)) !== undefined) {
      //Considering the diagram below with the empty tile in the middle,
      //there are four distinct case to handle this empty tile.
      //   1   |    2    |   3
      // -----------------------
      //   4   |emptyTile|   5
      // -----------------------
      //   6   |    7    |   8
      console.log('empty space found, located at column index: ' +
        emptyTileCoordinate['colId'] + ' row index: ' + emptyTileCoordinate['rowId']);
      // debugging by printing out the grids in the console
      debugGrid(grids);

      // Obtain a reference to the tile at location 1 and 2 for usage later.
      if (lastGrid[emptyTileCoordinate['colId'] - 1]) {
        var tileAtLocationOne = lastGrid[emptyTileCoordinate['colId'] - 1][emptyTileCoordinate['rowId'] - 1];
        if (tileAtLocationOne && tileAtLocationOne.isPlaceHolder()) {
          tileAtLocationOne = tileAtLocationOne.getTile();
        }
      }
      var tileAtLocationTwo = lastGrid[emptyTileCoordinate['colId']][emptyTileCoordinate['rowId'] - 1];
      if (tileAtLocationTwo && tileAtLocationTwo.isPlaceHolder()) {
        tileAtLocationTwo = tileAtLocationTwo.getTile();
      }

      // Determine which of the four cases occured
      var caseNr;
      if (emptyTileCoordinate['colId'] === 0) {
      //1. Empty tile is at the first column of the grid => location 1,4,5 do not exist.
      //solution: resize the image which covered location 2.
        caseNr = 1;
      } else if (emptyTileCoordinate['rowId'] === 0) {
        //2. Empty tile is at the first row of the grid => location 1,2,3 do not exist.
        //solution: resize the image which covered location 4.
        caseNr = 2;
      } else if (tileAtLocationOne.getImage().getImageId() === tileAtLocationTwo.getImage().getImageId()) {
        //3. Location 1 and 2 belong to the same image. location 4,6 is some other image(s).
        //solution: resize the image which covered location 4. (similar to case 2)
        caseNr = 3;
      } else {
        //4. Location 1 and 2 do NOT belong to the same image.
        //solution: resize the image which covered location 2. Have to check if there are
        //          other images below.
        caseNr = 4;
      }

      var rowsToFill, colsToFill;
      var origImageTile;
      // Uses the switch conditionals because two cases can be combined. Could
      // also combine the if-statement above. But that results in longer conditional,
      // and harder to understand later.
      switch (caseNr) {
        case 1:
          // console.log('empty tile is at first colomn');
          rowsToFill = lastGrid[0].length - emptyTileCoordinate['rowId'];
          colsToFill = 0;
          origImageTile = lastGrid[emptyTileCoordinate['colId']][emptyTileCoordinate['rowId'] - 1];
        break;
        case 2:
          // console.log('empty tile is at first row, columns to fill: ' + colsToFill);
          // Same solution as case 3.
        case 3:
          rowsToFill = 0;
          colsToFill = lastGrid.length - emptyTileCoordinate['colId'];
          origImageTile = lastGrid[emptyTileCoordinate['colId'] - 1][emptyTileCoordinate['rowId']];
        break;
        case 4:
          //Find out if there are images in the tiles below:
          for (var rowId = emptyTileCoordinate['rowId']; rowId < lastGrid[0].length; rowId++) {
            if (!lastGrid[emptyTileCoordinate['colId']][rowId].isEmptyPlaceHolder()) {
              // it's either a imageTile or an imagePlaceHolder
              break;
            }
          }
          colsToFill = 0;
          rowsToFill = rowId - emptyTileCoordinate['rowId'];
          origImageTile = lastGrid[emptyTileCoordinate['colId']][emptyTileCoordinate['rowId'] - 1];
        break;
      }
      if (origImageTile.isPlaceHolder()) {
        origImageTile = origImageTile.getTile();
      }
      expandImageGrid(lastGrid, origImageTile, rowsToFill, colsToFill);
    }
    console.log('empty space not found or solved');
  }
  return {

    /**
     * plan - The public function of the ImageGridPlanner object. Arguments
     * needed are provided at the creation of the object.
     *
     * @return {[][][]}  A 3d array containing the layout of all imageGrids.
     */
    plan: function() {
      if (!cImageProvider.moveToFirst()) {
        return undefined;
      }
      var grids = [];
      while(cImageProvider.hasCurrent()) {
        grids.push(planForAGrid());
      }

      /**
       * Conforming the spec, there cannot be any empty places in the grids.
       * After images are laid out, the last grid must be checked for any empty
       * tile. The empty tile(s), if found, have then to be covered up by images
       * in the grid.
       */
      findAndFixEmptySpace(grids);
      return grids;
    },
  }
}


/**
 * ImageGridPresenter - Responsible for rendering the grids on the browser
 * window using the data in the array.
 *
 * @param  {[][][]} argGrids          The 3d array representing the grids
 * @param  {ImageProvider} argImageProvider    A reference to the ImageProvider
 * @param  {Int} argColumns           Number of columns in a grid
 * @param  {Int} argRows              Number of rows in a grid
 * @param  {Int} argGridWidth         Width of a single grid
 * @param  {Int} argGridHeight        Height of a single grid
 * @param  {Int} argImageGapSpace     Space between two images in a grid
 * @param  {Int} argGirdGapSpace      Space between two grid
 */
function ImageGridPresenter(argGrids, argImageProvider, argColumns, argRows,
  argGridWidth, argGridHeight, argImageGapSize, argGridGapSize) {
  const cGrids = argGrids;
  const cImageProvider = argImageProvider;
  const cGridWidth = argGridWidth;
  const cGridHeight = argGridHeight;
  const cColums = argColumns;
  const cRows = argRows;
  const cSingleTileWidth = Math.round(argGridWidth / argColumns);
  const cSingleTileHeight = Math.round(argGridHeight / argRows);
  const cImageGapSize = argImageGapSize;
  const cGridGapSize = argGridGapSize;

  return {

    /**
     * showGrids - render the grids
     *
     */
    showGrids: function() {
      var tile, tileId;
      var tileWidth, tileHeight;
      var image, imageId, imageSrc, imageOrigSrc, imageQuality;
      var leftCoordinate, topCoordinate;
      const $body = $('body');

      // The ImageGrids are in this container.
      $body.append('<div id="imageGridsContainer"> </div>');

      for (var gridId = 0; gridId < cGrids.length; gridId++) {
        $('#imageGridsContainer').css({
          whiteSpace: "nowrap",
          minWidth: "100%",
        });

        // Insert the grids in the container
        $('#imageGridsContainer').append('<div class="grids" id="grid' + gridId + '"> </div>');
        for (var colId = 0; colId < cGrids[gridId].length; colId++) {
          leftCoordinate = colId * (cSingleTileWidth + cImageGapSize);
          for (var rowId = 0; rowId < cGrids[gridId][colId].length; rowId++) {
            topCoordinate = rowId * (cSingleTileHeight + cImageGapSize);
            tile = cGrids[gridId][colId][rowId];
            if (tile === undefined) {
              break;
            }
            if (tile.isPlaceHolder()) {
              continue;
            }
            tileId = 'tile' + gridId + '_' + colId + '_' + rowId;
            const $grid = $('#grid' + gridId);

            //Each image becomes a tile in the grid.
            $grid.append('<div class="tiles" id="' + tileId + '"> </div>');
            $grid.css({
              display: "inline-block",
              position: "relative",
              width: cGridWidth + (cColums - 1) * cImageGapSize,
              height: cGridHeight + (cRows - 1) * cImageGapSize,
              margin: "10px",
              left: '50px',
              opacity: '0',
            });

            //animating the appearance of the grids
            $grid.delay(500 + gridId * 75).animate({
              left: '0px',
              opacity: '1',
            }, 200, "linear");

            imageTileWidth = tile.getColsTaken() * cSingleTileWidth + ((tile.getColsTaken() - 1) * cImageGapSize);
            imageTileHeight = tile.getRowsTaken() * cSingleTileHeight + ((tile.getRowsTaken() - 1) * cImageGapSize);
            const $tile = $('#'+tileId);

            //coordinates and sizes of the tiles are set.
            $tile.css({
              position: "absolute",
              height: imageTileHeight,
              width: imageTileWidth,
              left: leftCoordinate,
              top: topCoordinate,
            });

            // Images are added to the tiles.
            image = tile.getImage();
            imageId = image.getImageId();
            imageQuality = image.getQuality();
            imageSrc = cImageProvider.getImageSrc(imageId, imageQuality);
            imageOrigSrc = cImageProvider.getOrigImageSrc(imageId);
            imageCaption = cImageProvider.getImageCaption(imageId);
            $tile.append('<img class="images" src="' + imageSrc + '" alt="' + imageCaption +'"> </img>');
            $tile.append('<div class="div-original" style="display: none;"">' + imageOrigSrc + '</div>')
            $('.images').css({
              height: "100%",
              width: "100%",
              left: "50%",
              top: "50%",
              position: "relative",
              transform: "translate(-50%, -50%)",
              objectFit: "cover",
            });
          }
        }
      }

      // Setup div-overlay for fullscreen image
      $body.append('<div class="div-overlay"><img class="img-overlay"> </img> </div>');
      const $divOverlay = $('.div-overlay');
      $divOverlay.css({
        position: 'fixed',
        width: '100%',
        height: '100%',
        top: '0px',
        left: '0px',
        display: 'none',
        opacity: '0',
      });
      $('.img-overlay').css({
        width: '100%',
        height: '100%',
        objectFit: 'contain',
        backgroundColor: 'rgba(0,0,0,.7)',
      })
      $divOverlay.click(function() {
        $divOverlay.delay(500).animate({
          opacity: '0',
        }, 200, "linear", function() {
          $divOverlay.hide();
        });
      });

      $('.tiles').click(function() {
        const origImageId = $(this).children('.div-original').text();
        console.log(origImageId);
        $('.img-overlay').attr('src', origImageId);
        $divOverlay.show();
        $divOverlay.delay(500).animate({
          opacity: '1',
        }, 200, "linear");

      });
    },
  }
}

/**
 * ImageProvider - The entry point for retrieving info about the images. The
 * object has a integer index that points to certain image at any moment. There
 * are function supplied to enable looping through all available images without
 * the need of knowing how the object internally works.
 *
 * @param  {array} argImages The initial image source
 */
function ImageProvider(argImages) {
  const cImages = argImages;
  const cQuality_Original = 'original';
  const cQuality_Large = 'large';
  const cQuality_Medium = 'medium';
  const cQuality_Small = 'small';

  // The integer index pointer.
  var currentImageIndex = 0;

  /**
   * getBestFitImageQualityByDimension
   *
   * @param  {type} dimension   description
   * @param  {type} size        description
   * @param  {type} withMinimum description
   * @return {type}             description
   */
  function getBestFitImageQualityByDimension(dimension, size, withMinimum) {
    var currentImage = cImages[currentImageIndex]['_links'];
    var quality;
    if (currentImage[cQuality_Small][dimension] >= size) {
      quality = cQuality_Small;
    } else if (currentImage[cQuality_Medium][dimension] >= size) {
      quality = cQuality_Medium;
    } else if (currentImage[cQuality_Large][dimension] >= size) {
      quality = cQuality_Large;
    } else if (currentImage[cQuality_Original][dimension] >= size || withMinimum) {
      quality = cQuality_Original;
    } else {
      return undefined;
    }
    return Image(currentImageIndex, currentImage[quality]['width'],
      currentImage[quality]['height'], quality);
  }

  /**
   * @return {type}  description
   */
  function getSmallWidth() {
    return cImages[currentImageIndex]['_links'][cQuality_Small]['width'];
  }

  /**
   * @return {type}  description
   */
  function getSmallHeight() {
    return cImages[currentImageIndex]['_links'][cQuality_Small]['height'];
  }

  return {

    /**
     * length - description
     *
     * @return {type}  description
     */
    length: function() {
      return cImages.length;
    },

    /**
     * getCurrentId - description
     *
     * @return {type}  description
     */
    getCurrentId: function() {
      return currentImageIndex;
    },

    /**
     * setCurrentId - description
     *
     * @param  {type} imageId description
     * @return {type}         description
     */
    setCurrentId: function(imageId) {
      currentImageIndex = imageId;
    },

    /**
     * moveToFirst - description
     *
     * @return {type}  description
     */
    moveToFirst: function() {
      currentImageIndex = 0;
      return this.hasCurrent();
    },

    /**
     * moveToNext - description
     *
     * @return {type}  description
     */
    moveToNext: function() {
      currentImageIndex++;
      return this.hasCurrent();
    },

    /**
     * getCurrentRatio - description
     *
     * @return {type}  description
     */
    getCurrentRatio: function() {
      return Math.round(getSmallWidth() / getSmallHeight() * 10) / 10;
    },

    /**
     * isLandscape - description
     *
     * @return {type}  description
     */
    isPortrait: function() {
      return getSmallWidth() <= getSmallHeight();
    },

    /**
     * getImageSrc - description
     *
     * @param  {type} argIndex   description
     * @param  {type} argQuality description
     * @return {type}            description
     */
    getImageSrc: function(argIndex, argQuality) {
      return cImages[argIndex]['_links'][argQuality]['href'];
    },


    /**
     * getOrigImageSrc - description
     *
     * @param  {type} argIndex   description
     * @param  {type} argQuality description
     * @return {type}            description
     */
    getOrigImageSrc: function(argIndex) {
      return cImages[argIndex]['_links'][cQuality_Original]['href'];
    },

    /**
     * getImageCaption - description
     *
     * @param  {type} argIndex description
     * @return {type}          description
     */
    getImageCaption: function(argIndex) {
      return cImages[argIndex]['caption'];
    },

    /**
     * hasCurrent - description
     *
     * @return {type}  description
     */
    hasCurrent: function() {
      return currentImageIndex < cImages.length;
    },

    /**
     * getBestFitImageQualityByWidth - description
     *
     * @param  {type} argSize        description
     * @param  {type} argWithMinimum description
     * @return {type}                description
     */
    getBestFitImageQualityByWidth: function(argSize, argWithMinimum) {
      return getBestFitImageQualityByDimension('width', argSize, argWithMinimum);
    },

    /**
     * getBestFitImageQualityByHeight - description
     *
     * @param  {type} argSize        description
     * @param  {type} argWithMinimum description
     * @return {type}                description
     */
    getBestFitImageQualityByHeight: function(argSize, argWithMinimum) {
      return getBestFitImageQualityByDimension('height', argSize, argWithMinimum);
    },
  }
}

/**
 * ImageTile - A object representing a single image together with how many
 * rows and columns it will cover and with which quality.
 *
 * @param  {type} argImage     description
 * @param  {type} argRowsTaken description
 * @param  {type} argColsTaken description
 * @return {type}              description
 */
function ImageTile(argImage, argRowsTaken, argColsTaken, argColId, argRowId) {
  const cImage = argImage;
  var cRowsTaken = argRowsTaken;
  var cColsTaken = argColsTaken;
  const cColId = argColId;
  const cRowId = argRowId;
  return {

    /**
     * getImage - description
     *
     * @return {type}  description
     */
    getImage: function() {
      return cImage;
    },

    /**
     * isPlaceHolder - description
     *
     * @return {type}  description
     */
    isPlaceHolder: function() {
      return false;
    },

    /**
     * isPlaceHolder - description
     *
     * @return {type}  description
     */
    isEmptyPlaceHolder: function() {
      return false;
    },

    /**
     * getRowsTaken - description
     *
     * @return {type}  description
     */
    getRowsTaken: function() {
      return cRowsTaken;
    },

    /**
     * getColsTaken - description
     *
     * @return {type}  description
     */
    getColsTaken: function() {
      return cColsTaken;
    },

    /**
     * getRowsTaken - description
     *
     * @return {type}  description
     */
    setRowsTaken: function(argRowsTaken) {
      cRowsTaken = argRowsTaken;
    },

    /**
     * getColsTaken - description
     *
     * @return {type}  description
     */
    setColsTaken: function(argColsTaken) {
      cColsTaken = argColsTaken;
    },

    /**
     * getRowId - description
     *
     * @return {type}  description
     */
    getRowId: function() {
      return cRowId;
    },

    /**
     * getColId - description
     *
     * @return {type}  description
     */
    getColId: function() {
      return cColId;
    },
  }
}

/**
 * Image - The object representing an single image with coresponding getters.
 *
 * @param  {type} argImageId description
 * @param  {type} argWidth   description
 * @param  {type} argHeight  description
 * @param  {type} argQuality description
 * @return {type}            description
 */
function Image(argImageId, argWidth, argHeight, argQuality) {
  const cImageId = argImageId;
  const cImageQuality = argQuality;
  const cWidth = argWidth;
  const cHeight = argHeight;
  const cQuality_Original = 'original';
  const cQuality_Large = 'large';
  const cQuality_Medium = 'medium';
  const cQuality_Small = 'small';

  return {
    getImageId: function() {
      return cImageId;
    },
    getQuality: function() {
      return cImageQuality;
    },
    getHeight: function() {
      return cHeight;
    },
    getWidth: function() {
      return cWidth;
    },
    isHighestQuality: function() {
      return cImageQuality === cQuality_Original;
    },
  }
}

/**
 * PlaceHolder - This object is used as a placeholder when an image covers
 * multiple tiles in a grid. Only the most upper-left tile will contain the
 * ImageTile object of that image.
 *
 * @return {type}  description
 */
function PlaceHolder(argTile) {
  const tile = argTile;

  return {
    isPlaceHolder: function() {
      return true;
    },
    isEmptyPlaceHolder: function() {
      return tile === undefined;
    },
    getTile: function() {
      return tile;
    },
  }
}

/**
 * debugGrid - Output the resulting grids layout in the console log for debug purpose.
 *
 * @param  {[][][]} grids 3-d array representation of the grids
 */
function debugGrid(grids) {
  console.log(' grid debug: \n rowsTaken : columnsTaken \n ');
  log = '';
  for (var gid = 0; gid<grids.length; gid++) {
    console.log('grid' + gid + '  ---------');
    for (var rid = 0; rid<grids[gid][0].length; rid++) {
      log += rid + ': ';
      for ( var cid = 0; cid<grids[gid].length; cid++) {
        tile = grids[gid][cid][rid];
        if (tile === undefined) {
          log += 'und ';
        } else if (!tile.isPlaceHolder()) {
          log += tile.getRowsTaken() + ':';
          log += tile.getColsTaken() + ' ';
        } else if (!tile.isEmptyPlaceHolder()) {
          log += 'pla ';
        } else {
          log += 'emp ';
        }
      }
      console.log(log);
      log = '';
    }
  }
}

/**
 * include - this function adds the provided script source to the DOM.
 *
 * @param  {type} filename Js source address
 * @param  {type} onload   Callback function after loaded
 */
function include(filename, onload) {
    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.src = filename;
    script.type = 'text/javascript';
    script.onload = script.onreadystatechange = function() {
        if (script.readyState) {
            if (script.readyState === 'complete' || script.readyState === 'loaded') {
                script.onreadystatechange = null;
                onload();
            }
        }
        else {
            onload();
        }
    };
    head.appendChild(script);
}

/**
 * include - Add jQuery to the DOM.
 *
 * @param  {type} 'https://ajax.googleapis.com/ajax/libs/jquery/2.2.2/jquery.min.js' description
 */
include('jquery.min.js', function() {
    $(document).ready(function() {
        // $.getJSON("waves.json", function(data) {
        $.getJSON("youngpeople.json", function(data) {
          imageGrid(data, 8,8,800,800);
        })
    });
});
