import { prisma } from "../..";

// Import Proto
import { wm } from "../../wmmt/wm.proto";
import wmproto  from "../../wmmt/wm.proto";

// Import Util
import * as common from "../../util/common";
import * as ghost_history from "../ghost/ghost_history";
import * as ghost_stamp from "../ghost/ghost_stamp";

// Save ghost battle result
export async function saveGhostBattleResult(body: wm.protobuf.SaveGameResultRequest, car: any)
{
    // Declare variable for return
    let ghostModePlay: boolean = false;
    let updateNewTrail: boolean = false;
    let OCMModePlay: boolean = false;

    // If the game was not retired / timed out
    if (!(body.retired || body.timeup)) 
    {
        console.log('Saving Ghost Battle Result');
        
        // Set ghost mode play to true for saving the ghost trail later
        ghostModePlay = true;

        // Declare data
        let dataCar : any;
        let dataGhost : any;
        let dataHighway : any;

        // Get the ghost result for the car
        let cars = body?.car;

        // Car is set
        if (cars)
        {
            // Error handling to prevent set ghost level to out of range value
            if(cars.ghostLevel)
            {
                if(cars.ghostLevel < 1)
                {
                    cars.ghostLevel = 1;
                }
                else if(cars.ghostLevel > 11)
                {
                    cars.ghostLevel = 10;
                }
            }

            // Car update data
            dataCar = {
                wheel: common.sanitizeInput(cars.wheel), 
                wheelColor: common.sanitizeInput(cars.wheelColor), 
                aero: common.sanitizeInput(cars.aero), 
                bonnet: common.sanitizeInput(cars.bonnet),
                wing: common.sanitizeInput(cars.wing),
                mirror: common.sanitizeInput(cars.mirror),
                neon: common.sanitizeInput(cars.neon),
                trunk: common.sanitizeInput(cars.trunk),
                plate: common.sanitizeInput(cars.plate),
                plateColor: common.sanitizeInput(cars.plateColor),
                plateNumber: common.sanitizeInput(cars.plateNumber),
                ghostLevel: common.sanitizeInput(cars.ghostLevel),
            }
        }

        // Get the ghost result for the car
        let ghostResult = body?.rgResult;

        // ghostResult is set
        if (ghostResult)
        {
            let stampSheet: any = undefined;
            if(ghostResult.stampSheet!.length > 0)
            {
                stampSheet = ghostResult.stampSheet;
            }

            // Ghost update data
            dataGhost = {
                rgRegionMapScore: common.sanitizeInput(ghostResult.rgRegionMapScore), 
                rgPlayCount: common.sanitizeInput(ghostResult.rgPlayCount), 
                dressupLevel: common.sanitizeInput(ghostResult.dressupLevel), 
                dressupPoint: common.sanitizeInput(ghostResult.dressupPoint),
                stampSheet: stampSheet,
                stampSheetCount: common.sanitizeInputNotZero(ghostResult.stampSheetCount),
            }

            // Count total win based on region map score
            if(ghostResult.rgRegionMapScore && ghostResult.rgRegionMapScore.length !== 0)
            {
                let winCounter = 0;

                // Count the total win
                for(let i=0; i<ghostResult.rgRegionMapScore.length; i++)
                {
                    winCounter += ghostResult.rgRegionMapScore[i];
                }
                
                // Set the data 
                dataGhost.rgWinCount = winCounter;
                dataGhost.rgScore = winCounter;
            }
        }

        // Get the ghost result for the car
        let highwayResult = body.rgResult?.highwayResult;

        // ghostResult is set
        if (highwayResult)
        {
            // Highway Ghost update data
            dataHighway = {
                rgHighwayClearCount: common.sanitizeInput(highwayResult.rgHighwayClearCount), 
                rgHighwayPoint: common.sanitizeInput(highwayResult.rgHighwayPoint), 
                rgHighwayStationClearBits: common.sanitizeInput(highwayResult.rgHighwayStationClearBits), 
                rgHighwayPreviousDice: common.sanitizeInput(highwayResult.rgHighwayPreviousDice),
            }
        }
        
        // Update the car properties
        await prisma.car.update({
            where: {
                carId: body.carId
            },
            data: {
                ...dataCar,
                ...dataGhost,
                ...dataHighway
            }
        }); 


        // --------------GHOST BATTLE SELECTION MODE--------------
        // Calling save ghost history battle function (BASE_PATH/src/util/games/games_util/ghost_history.ts)
        let ghost_historys: any;

        switch (body.rgResult!.selectionMethod) 
        {
            // Ghost Battle Search by Region (1)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SEARCH_BY_REGION:
            {
                console.log('Normal Ghost Mode Found - Search by Region');

                ghost_historys = await ghost_history.saveGhostHistory(body);

                // Return Stamp (Shuttle Match)
                await ghost_stamp.shuttleReturnStamp(body);

                // Update the updateNewTrail value
                updateNewTrail = ghost_historys.updateNewTrail;

                break;
            }

            // Ghost Battle Select by Level (2)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_BY_LEVEL:
            {
                console.log('Normal Ghost Mode Found - Select by Level');

                ghost_historys = await ghost_history.saveGhostHistory(body);

                // Return Stamp (Shuttle Match)
                await ghost_stamp.shuttleReturnStamp(body);

                // Update the updateNewTrail value
                updateNewTrail = ghost_historys.updateNewTrail;

                break;
            }

            // Crown Ghost Battle Mode (3)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_CROWN_MATCH:
            {
                console.log('Crown Ghost Mode Found');

                // Not losing to the crown ghost battle
                if (body.rgResult?.acquireCrown !== false && body.rgResult?.acquireCrown)
                {
                    console.log('Win the Crown Ghost Battle');

                    // Get the ghost crown result
                    let ghostResultCrown = body?.rgResult;

                    // Declare data
                    let dataCrown : any;

                    // ghostResultCrown is set
                    if (ghostResultCrown)
                    {
                        let carId: number = 0;
                        if(body.carId)
                        {
                            carId = Number(body.carId);
                        }

                        // Ghost Crown update data
                        dataCrown = {
                            carId: carId,
                            playedAt: common.sanitizeInput(body.playedAt),
                            tunePower: common.sanitizeInput(body.car?.tunePower),
                            tuneHandling: common.sanitizeInput(body.car?.tuneHandling),
                        }

                        // Get the area id and ramp id
                        let area = 0;
                        let ramp = 0;
                        let path = 0;
                        if(body.rgResult?.path)
                        {
                            if(body.rgResult?.path >= 0 && body.rgResult?.path <= 9){ // GID_PATH_C1
                                area = Number(0);
                                ramp = Number(Math.floor(Math.random() * 4));
                            }
                            else if(body.rgResult?.path >= 10 && body.rgResult?.path <= 15){ // GID_PATH_N9
                                area = Number(1);
                                ramp = Number(Math.floor(Math.random() * 2) + 4);
                            }
                            else if(body.rgResult?.path >= 16 && body.rgResult?.path <= 17){ // GID_PATH_WTEAST
                                area = Number(2);
                                ramp = Number(Math.floor(Math.random() * 2) + 6);
                            }
                            else if(body.rgResult?.path >= 18 && body.rgResult?.path <= 19){ // GID_PATH_WT_UP_DOWN
                                area = Number(3);
                                ramp = Number(Math.floor(Math.random() * 2) + 8);
                            }
                            else if(body.rgResult?.path >= 20 && body.rgResult?.path <= 26){ // GID_PATH_WG
                                area = Number(4);
                                ramp = Number(Math.floor(Math.random() * 4) + 10);
                            }
                            else if(body.rgResult?.path >= 27 && body.rgResult?.path <= 33){ // GID_PATH_KG
                                area = Number(5);
                                ramp = Number(Math.floor(Math.random() * 4) + 14);
                            }
                            else if(body.rgResult?.path >= 34 && body.rgResult?.path <= 37){ // GID_PATH_YS
                                area = Number(6);
                                ramp = Number(Math.floor(Math.random() * 3) + 18);
                            }
                            else if(body.rgResult?.path >= 38 && body.rgResult?.path <= 48){ // GID_PATH_KG_SHINYAMASHITA_MINATOMIRAI
                                area = Number(7);
                                ramp = Number(Math.floor(Math.random() * 4) + 21);
                            }
                            else if(body.rgResult?.path === 49){ // GID_PATH_NGR
                                area = Number(8);
                                ramp = Number(25);
                            }
                            else if(body.rgResult?.path >= 50 && body.rgResult?.path <= 53){ // GID_PATH_OS
                                area = Number(9);
                                ramp = Number(26);
                            }
                            else if(body.rgResult?.path >= 54 && body.rgResult?.path <= 55){ // GID_PATH_KB
                                area = Number(10);
                                ramp = Number(Math.floor(Math.random() * 2) + 27);
                            }
                            else if(body.rgResult?.path >= 58 && body.rgResult?.path <= 61){ // GID_PATH_FK
                                area = Number(11);
                                ramp = Number(Math.floor(Math.random() * 4) + 29);
                            }
                            else if(body.rgResult?.path >= 62 && body.rgResult?.path <= 63){ // GID_PATH_HK
                                area = Number(12);
                                ramp = Number(Math.floor(Math.random() * 2) + 33);
                            }
                            else if(body.rgResult?.path >= 64 && body.rgResult?.path <= 65){ // GID_PATH_TP
                                area = Number(13);
                                ramp = Number(Math.floor(Math.random() * 2) + 35);
                            }
                            else if(body.rgResult?.path >= 56 && body.rgResult?.path <= 57){ // GID_PATH_HS
                                area = Number(18);
                                ramp = Number(Math.floor(Math.random() * 2) + 27);
                            }

                            path = Number(body.rgResult.path);
                        }

                        // Get the available crown holder data
                        let carCrowns = await prisma.carCrown.count({ 
                            where: {
                                area: area
                            }
                        });

                        // Crown holder data available
                        if(carCrowns !== 0)
                        { 
                            // Update it to the new one
                            let areaVal = Number(area);
                            await prisma.carCrown.update({ 
                                where: {
                                    area: areaVal
                                },
                                data: {
                                    ...dataCrown,
                                    area: area,
                                    ramp: ramp,
                                    path: path
                                }
                            });
                        }
                        // Crown holder data not available or still default crown holder data
                        else
                        { 
                            await prisma.carCrown.create({
                                data: {
                                    ...dataCrown,
                                    area: area,
                                    ramp: ramp,
                                    path: path
                                }
                            });
                        }
                    }
                    
                    updateNewTrail = true;
                }
                // Losing to the crown ghost battle
                else
                {
                    console.log('Lose the Crown Ghost Battle');

                    updateNewTrail = false;
                }

                await ghost_history.saveGhostHistory(body);

                break;
            }

            // Ghost Battle Select Stamp Match (4)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_STAMP_MATCH:
            {
                console.log('Normal Ghost Mode Found - Select Stamp Match');

                ghost_historys = await ghost_history.saveGhostHistory(body);

                // Return Stamp (Shuttle Match)
                await ghost_stamp.shuttleReturnStamp(body);

                // Update the updateNewTrail value
                updateNewTrail = ghost_historys.updateNewTrail;

                break;
            }

            // Ghost Battle Select from History (5)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_FROM_HISTORY:
            {
                console.log('Normal Ghost Mode Found - Select from History');

                ghost_historys = await ghost_history.saveGhostHistory(body);

                // Return Stamp (Shuttle Match)
                await ghost_stamp.shuttleReturnStamp(body);

                // Update the updateNewTrail value
                updateNewTrail = ghost_historys.updateNewTrail;

                break;
            }

            // Ghost Battle Search by Shop (6)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SEARCH_BY_SHOP:
            {
                console.log('Normal Ghost Mode Found - Search by Shop');

                ghost_historys = await ghost_history.saveGhostHistory(body);

                // Return Stamp (Shuttle Match)
                await ghost_stamp.shuttleReturnStamp(body);

                // Update the updateNewTrail value
                updateNewTrail = ghost_historys.updateNewTrail;

                break;
            }

            // Ghost Battle Search by Name (7)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SEARCH_BY_NAME:
            {
                console.log('Normal Ghost Mode Found - Search by Name');

                ghost_historys = await ghost_history.saveGhostHistory(body);

                // Return Stamp (Shuttle Match)
                await ghost_stamp.shuttleReturnStamp(body);

                // Update the updateNewTrail value
                updateNewTrail = ghost_historys.updateNewTrail;

                break;
            }

            // Ghost Battle Challenger (8)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_ACCEPT_CHALLENGER:
            {
                console.log('Normal Ghost Mode Found - Challenger');

                ghost_historys = await ghost_history.saveGhostHistory(body);

                // Return Stamp (Shuttle Match)
                await ghost_stamp.shuttleReturnStamp(body);

                // Update the updateNewTrail value
                updateNewTrail = ghost_historys.updateNewTrail;

                break;
            }

            // OCM Ghost Battle Mode (11)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_COMPETITION:
            {
                console.log('OCM Ghost Mode Found');
                
                OCMModePlay = true;

                // Get the rg result for the car
                let rgResult = body?.rgResult;

                // rgResult is set
                if (rgResult)
                {
                    let data : any = {
                        carId: body.carId,
                        competitionId: common.sanitizeInput(rgResult.competitionId),
                        periodId: common.sanitizeInput(rgResult.periodId) || 0,
                        brakingPoint: common.sanitizeInput(rgResult.brakingPoint) || 0,
                        playedAt: common.sanitizeInput(body.playedAt),
                    }

                    // Get the user's available OCM Battle data
                    let countOCM = await prisma.oCMPlayRecord.count({ 
                        where: {
                            competitionId: data.competitionId,
                            carId: body.carId
                        }
                    });

                    // User's OCM Battle data available
                    if(countOCM !== 0)
                    {
                        console.log('OCM Play Record found');
                        console.log('Updaing OCM Play Record entry');

                        await prisma.oCMPlayRecord.updateMany({
                            where:{
                                carId: data.carId,
                                competitionId: data.competitionId,
                            },
                            data: data
                        });
                    }
                    // First time User playing OCM Battle
                    else
                    { 
                        console.log('OCM Play Record not found');
                        console.log('Creating new OCM Play Record entry');

                        await prisma.oCMPlayRecord.create({
                            data: data
                        });
                    }

                    ghost_historys = await ghost_history.saveOCMGhostHistory(body);

                    // Update the updateNewTrail value
                    updateNewTrail = ghost_historys.updateNewTrail;
                }
                
                break;
            }

            // Ghost Battle Select from Bookmars (12)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_FROM_BOOKMARKS:
            {
                console.log('Normal Ghost Mode Found - Select from Bookmars');

                ghost_historys = await ghost_history.saveGhostHistory(body);

                // Return Stamp (Shuttle Match)
                await ghost_stamp.shuttleReturnStamp(body);

                // Update the updateNewTrail value
                updateNewTrail = ghost_historys.updateNewTrail;

                break;
            }

            // Ghost Battle Expedition (13)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_EXPEDITION:
            {
                console.log('Normal Ghost Mode Found - VS Other Region (Expedition)');

                ghost_historys = await ghost_history.saveVSORGGhostHistory(body);

                // Return Stamp (Shuttle Match)
                await ghost_stamp.shuttleReturnStamp(body);

                // Update the updateNewTrail value
                updateNewTrail = ghost_historys.updateNewTrail;

                break;
            }

            // Ghost Battle Select by Place (14)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_BY_PLACE:
            {
                console.log('Normal Ghost Mode Found - Select by Place');

                // TODO: Make saving
                ghost_historys = await ghost_history.saveGhostHistory(body);

                // Return Stamp (Shuttle Match)
                await ghost_stamp.shuttleReturnStamp(body);

                // Update the updateNewTrail value
                updateNewTrail = ghost_historys.updateNewTrail;

                break;
            }

            // Ghost Battle Select by Other Place (15)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_BY_OTHER_PLACE:
            {
                console.log('Normal Ghost Mode Found - Select by Other Place');

                // TODO: Make saving
                ghost_historys = await ghost_history.saveGhostHistory(body);

                // Return Stamp (Shuttle Match)
                await ghost_stamp.shuttleReturnStamp(body);

                // Update the updateNewTrail value
                updateNewTrail = ghost_historys.updateNewTrail;

                break;
            }

            // Ghost Battle Select by Manufacturer (16)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_BY_MANUFACTURER:
            {
                console.log('Normal Ghost Mode Found - Select by Manufacturer');

                // TODO: Make saving
                ghost_historys = await ghost_history.saveGhostHistory(body);

                // Return Stamp (Shuttle Match)
                await ghost_stamp.shuttleReturnStamp(body);

                // Update the updateNewTrail value
                updateNewTrail = ghost_historys.updateNewTrail;

                break;
            }

            // Ghost Battle Select by Other Manufacturer (17)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_BY_OTHER_MANUFACTURER:
            {
                console.log('Normal Ghost Mode Found - Select by Other Manufacturer');

                // TODO: Make saving
                ghost_historys = await ghost_history.saveGhostHistory(body);

                // Return Stamp (Shuttle Match)
                await ghost_stamp.shuttleReturnStamp(body);

                // Update the updateNewTrail value
                updateNewTrail = ghost_historys.updateNewTrail;

                break;
            }

            // Ghost Battle Select by Played (18)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_BY_PLAYED:
            {
                console.log('Normal Ghost Mode Found - Select by Played');

                // TODO: Make saving
                ghost_historys = await ghost_history.saveGhostHistory(body);

                // Return Stamp (Shuttle Match)
                await ghost_stamp.shuttleReturnStamp(body);

                // Update the updateNewTrail value
                updateNewTrail = ghost_historys.updateNewTrail;

                break;
            }

            // Ghost Battle Select by Region Manufacturer (20)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_BY_REGION_MANUFACTURER:
            {
                console.log('Normal Ghost Mode Found - Select by Region Manufacturer');

                // TODO: Make saving
                ghost_historys = await ghost_history.saveGhostHistory(body);

                // Return Stamp (Shuttle Match)
                await ghost_stamp.shuttleReturnStamp(body);

                // Update the updateNewTrail value
                updateNewTrail = ghost_historys.updateNewTrail;

                break;
            }

            // Ghost Battle Select by Region Played (22)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_BY_REGION_PLAYED:
            {
                console.log('Normal Ghost Mode Found - Select by Region Played');

                // TODO: Make saving
                ghost_historys = await ghost_history.saveGhostHistory(body);

                // Return Stamp (Shuttle Match)
                await ghost_stamp.shuttleReturnStamp(body);

                // Update the updateNewTrail value
                updateNewTrail = ghost_historys.updateNewTrail;

                break;
            }

            // Ghost Battle Select by Region Station (23)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_BY_REGION_STATION:
            {
                console.log('Normal Ghost Mode Found - Select by Region Station');

                // TODO: Make saving
                ghost_historys = await ghost_history.saveGhostHistory(body);

                // Return Stamp (Shuttle Match)
                await ghost_stamp.shuttleReturnStamp(body);

                // Update the updateNewTrail value
                updateNewTrail = ghost_historys.updateNewTrail;

                break;
            }

            // Ghost Battle Select by Region Boss (24)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_BY_REGION_BOSS:
            {
                console.log('Normal Ghost Mode Found - Select by Region Boss');

                // TODO: Make saving
                ghost_historys = await ghost_history.saveGhostHistory(body);

                // Return Stamp (Shuttle Match)
                await ghost_stamp.shuttleReturnStamp(body);

                // Update the updateNewTrail value
                updateNewTrail = ghost_historys.updateNewTrail;

                break;
            }

            // Ghost Battle Select by Region Place (25)
            case wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_BY_REGION_PLACE:
            {
                console.log('Normal Ghost Mode Found - Select by Region Place');

                // TODO: Make saving
                ghost_historys = await ghost_history.saveGhostHistory(body);

                // Return Stamp (Shuttle Match)
                await ghost_stamp.shuttleReturnStamp(body);

                // Update the updateNewTrail value
                updateNewTrail = ghost_historys.updateNewTrail;

                break;
            }
        }
    }
    // Retiring Ghost Battle
    else if(body.rgResult!.selectionMethod === wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SEARCH_BY_REGION ||
        body.rgResult!.selectionMethod === wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_BY_LEVEL ||
        body.rgResult!.selectionMethod === wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_CROWN_MATCH ||
        body.rgResult!.selectionMethod === wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_STAMP_MATCH || 
        body.rgResult!.selectionMethod === wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_FROM_HISTORY ||
        body.rgResult!.selectionMethod === wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SEARCH_BY_SHOP || 
        body.rgResult!.selectionMethod === wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SEARCH_BY_NAME ||
        body.rgResult!.selectionMethod === wmproto.wm.protobuf.GhostSelectionMethod.GHOST_ACCEPT_CHALLENGER ||
        body.rgResult!.selectionMethod === wmproto.wm.protobuf.GhostSelectionMethod.GHOST_SELECT_FROM_BOOKMARKS)
    {
        console.log('Normal Ghost Mode Found but Retiring');

        // Get the ghost result for the car
        let ghostResult = body?.rgResult;

        // ghostResult is set
        if (ghostResult)
        {
            // Ghost update data
            let dataGhost = {
                rgPlayCount: common.sanitizeInput(ghostResult.rgPlayCount), 
            }

            // Update the car properties
            await prisma.car.update({
                where: {
                    carId: body.carId
                },
                data: {
                    ...dataGhost
                }
            }); 
        }
    }
    // Retiring OCM for mini games
    else if(body.rgResult!.selectionMethod === wmproto.wm.protobuf.GhostSelectionMethod.GHOST_COMPETITION)
    {
        // Get current date
        let date = Math.floor(new Date().getTime() / 1000);

        // Get currently active OCM event
        let ocmEventDate = await prisma.oCMEvent.findFirst({ 
            where: {
                // qualifyingPeriodStartAt is less than equal current date
                qualifyingPeriodStartAt: { lte: date },
    
                // competitionEndAt is greater than equal current date
                competitionEndAt: { gte: date },
            },
            orderBy:{
                dbId: 'desc'
            }
        });

        if(ocmEventDate!.qualifyingPeriodStartAt < date && ocmEventDate!.qualifyingPeriodCloseAt > date)
        { 
            console.log('OCM Ghost Mode Found but Retiring');

            // Get the rg result for the car
            let rgResult = body?.rgResult;

            // rgResult is set
            if (rgResult)
            {
                let data : any = {
                    carId: body.carId,
                    competitionId: common.sanitizeInput(rgResult.competitionId),
                    periodId: common.sanitizeInput(rgResult.periodId) || 0,
                    brakingPoint: common.sanitizeInput(rgResult.brakingPoint) || 0,
                    playedAt: common.sanitizeInput(body.playedAt),
                }

                // Get the user's available OCM Battle data
                let countOCM = await prisma.oCMPlayRecord.count({ 
                    where: {
                        competitionId: data.competitionId,
                        carId: body.carId
                    }
                });

                // User's OCM Battle data available
                if(countOCM !== 0)
                {
                    console.log('OCM Play Record found');
                    console.log('Updaing OCM Play Record entry');

                    await prisma.oCMPlayRecord.updateMany({
                        where:{
                            carId: data.carId,
                            competitionId: data.competitionId,
                        },
                        data: data
                    });
                }
                // First time User playing OCM Battle
                else
                { 
                    console.log('OCM Play Record not found');
                    console.log('Creating new OCM Play Record entry');

                    await prisma.oCMPlayRecord.create({
                        data: data
                    });
                }
            }
        }
    }
    // Retiring VS ORG
    else if(body.rgResult!.selectionMethod === wmproto.wm.protobuf.GhostSelectionMethod.GHOST_EXPEDITION)
    {
        console.log('VSORG (Expedition) Ghost Mode Found but Retiring');

        // Get the ghost result for the car
        let ghostResult = body?.rgResult;

        // Get current date
        let date = Math.floor(new Date().getTime() / 1000);

        // ghostResult is set
        let dataGhost: any;
        if (ghostResult)
        {
            dataGhost = {
                rgPlayCount: common.sanitizeInput(ghostResult.rgPlayCount), 
            }

            // Update the car properties
            await prisma.car.update({
                where: {
                    carId: body.carId
                },
                data: {
                    ...dataGhost
                }
            });

            // Making wanted car
            let dataWantedGhost = {
                carId: common.sanitizeInput(ghostResult.opponents![0].carId),
                bonus: 0,
                numOfHostages: 1,
                defeatedMeCount: 1,
            }

            let checkWantedCar = await prisma.ghostExpeditionWantedCar.findFirst({
                where:{
                    carId: dataWantedGhost.carId
                }
            })

            if(checkWantedCar)
            {
                console.log('Updating Wanted Car');

                dataWantedGhost.bonus = checkWantedCar.bonus + 1;
                dataWantedGhost.defeatedMeCount = checkWantedCar.defeatedMeCount + 1;

                await prisma.ghostExpeditionWantedCar.update({
                    where:{
                        dbId: checkWantedCar.dbId
                    },
                    data: dataWantedGhost
                })
            }
            else
            {
                console.log('Creating Wanted Car');

                await prisma.ghostExpeditionWantedCar.create({
                    data: dataWantedGhost
                })
            }
            
        }

        // Get the ghost expedition result for the car
        let expeditionResult = body.rgResult?.expeditionResult;

        // expeditionResult is set
        if (expeditionResult)
        {
            // Expedition update data
            let dataExpedition = {
                ghostExpeditionId: common.sanitizeInput(expeditionResult.ghostExpeditionId),
                sugorokuPoint: common.sanitizeInput(expeditionResult.sugorokuPoint),
                earnedScore: common.sanitizeInput(expeditionResult.earnedScore),
                score: common.sanitizeInput(expeditionResult.score),
            }
            
            let checkExpeditionData = await prisma.ghostExpedition.findFirst({
                where:{
                    carId: body.carId
                }
            }); 

            // Update the expedition data
            if(checkExpeditionData)
            {
                await prisma.ghostExpedition.update({
                    where:{
                        dbId: checkExpeditionData.dbId
                    },
                    data: {
                        ...dataExpedition
                    }
                }); 
            }
            // Create the expedition data
            else
            {
                await prisma.ghostExpedition.create({
                    data: {
                        carId: body.carId,
                        ...dataExpedition
                    }
                }); 
            }
            
            if(expeditionResult.earnedItems!.length !== 0)
            {
                console.log('User Item reward from VSORG available, continuing ...');

				for(let i=0; i<expeditionResult.earnedItems!.length; i++)
                {
					await prisma.userItem.create({
						data: {
							category: expeditionResult.earnedItems![i].category,
							itemId: expeditionResult.earnedItems![i].itemId,
							userId: body.car!.userId!,
							earnedAt: date,
							type: 0
						}
					});
				}
            }

            if(expeditionResult.aftereventBonus!.length !== 0)
            {
                console.log('User Item after event reward from VSORG available, continuing ...');

                for(let i=0; i<expeditionResult.aftereventBonus!.length; i++)
                {
                    /*
                    await prisma.userItem.create({
                        data: {
                            category: expeditionResult.earnedItems![i].category,
                            itemId: expeditionResult.earnedItems![i].itemId,
                            userId: body.car!.userId!,
                            earnedAt: date,
                            type: 0
                        }
                    });*/
                }
            }
        }

        // Check full tune ticket piece
        let checkFTTicketPiece = await prisma.userItem.findMany({
            where:{
                userId: body.car!.userId!,
                category: 202,
                itemId: 2
            }
        });

        if(checkFTTicketPiece.length >= 6)
        {
            // Give full tune ticket :)
            await prisma.userItem.create({
                data:{
                    userId: body.car!.userId!,
                    category: 203,
                    itemId: 5,
                    type: 0,
                    earnedAt: date
                }
            });
            
            // Remove full tune ticket piece :(
            await prisma.userItem.deleteMany({
                where:{
                    userId: body.car!.userId!,
                    category: 202,
                    itemId: 2,
                }
            });
        }
    }
    // TODO: Highway Ghost Mode Retiring Saving

    // Return the value to 'BASE_PATH/src/modules/game.ts'
    return { ghostModePlay, updateNewTrail, OCMModePlay }
} 