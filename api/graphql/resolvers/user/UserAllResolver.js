const BaseResolver = require('../../BaseResolver');
const {GraphQLString, GraphQLInt} = require('graphql');

class UserAllResolver extends BaseResolver {

    get args() {
        return {
            fullName: {
                type: GraphQLString,
                description: 'full name for the user.'
            },
            // age: {
            //     type: GraphQLInt,
            //     description: "Age of the user"
            // }
        };
    }

    async resolve(parentValue, args, ctx) {
        //calling super method to check authentication if applicable
        super.resolve(parentValue, args, ctx);

        try {
            return await ctx.db.User.find(args).lean();
        } catch (e) {
            throw new Error(e);
        }
    }
}

module.exports = UserAllResolver;