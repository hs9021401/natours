const catchAsync = require('./../utils/catchAsync');
const AppError = require('./../utils/appError');
const APIFeatures = require('./../utils/apiFeatures');

//建立一個通用型generic的function, 將Model(User, Tour, Review,....等)當作參數帶進去
exports.deleteOne = Model =>
    catchAsync(async (req, res, next) => {
        const doc = await Model.findByIdAndDelete(req.params.id);

        if (!doc) {
            return next(new AppError('No document found with that ID!', 404));
        }
        res.status(204).json({
            status: 'success',
            data: null
        });
    });

exports.updateOne = Model =>
    catchAsync(async (req, res, next) => {
        const doc = await Model.findByIdAndUpdate(req.params.id, req.body, {
            new: true, //new: bool - true to return the modified document rather than the original. defaults to false
            runValidators: true //if true, runs update validators on this command. Update validators validate the update operation against the model's schema.
        });

        if (!doc) {
            return next(new AppError('No document found with that ID!', 404));
        }

        res.status(200).json({
            status: 'success',
            data: {
                data: doc
            }
        });
    });

exports.createOne = Model =>
    catchAsync(async (req, res, next) => {
        const doc = await Model.create(req.body);

        res.status(201).json({
            status: 'success',
            data: {
                data: doc
            }
        });
    });

exports.getOne = (Model, popOptions) =>
    catchAsync(async (req, res, next) => {
        let query = Model.findById(req.params.id);
        if (popOptions) query = query.populate(popOptions);

        const doc = await query;

        if (!doc) {
            return next(new AppError('No document found with that ID!', 404));
        }

        res.status(200).json({
            status: 'success',
            data: doc
        });
    });

exports.getAll = Model =>
    catchAsync(async (req, res, next) => {
        //To allow for nested GET review on tour (hack)
        let filter = {};
        if (req.params.tourId) {
            filter = { tour: req.params.tourId };
        }

        // EXECUTE QUERY
        const features = new APIFeatures(Model.find(filter), req.query) //放入Query物件, 和從express進來的query string (JSON物件)
            .filter()
            .sort()
            .limitFields()
            .paginate();

        // const doc = await features.query.explain();  //explain() 可以在query後列出一些查詢統計資訊
        const doc = await features.query;

        // SEND RESPONSE
        res.status(200).json({
            status: 'success',
            result: doc.length,
            data: {
                data: doc
            }
        });
    });
