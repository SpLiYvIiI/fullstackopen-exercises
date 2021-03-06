const { ApolloServer, gql,UserInputError,AuthenticationError,PubSub } = require('apollo-server')

const mongoose = require('mongoose')
const pubsub = new PubSub()
const Author = require('./models/Author')
const Book = require('./models/Book')
const User = require('./models/User')

const jwt = require('jsonwebtoken')

const JWT_SECRET = 'ATULIE'
mongoose.set('useFindAndModify', false)

const MONGODB_URI = 'mongodb+srv://xella:atulie123@phonebook.uwp6j.mongodb.net/library-app?retryWrites=true&w=majority'


mongoose.set('useCreateIndex', true)

console.log('connecting to', MONGODB_URI)

mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('connected to MongoDB')
  })
  .catch((error) => {
    console.log('error connection to MongoDB:', error.message)
  })
const typeDefs = gql`
        type User {
          username: String!
          favoriteGenre: String!
          id: ID!
        }

        type Token {
          value: String!
        }

    type Author {
        name : String!
        born : Int
        bookCount : Int!
        id : ID!
    }
    type Book {
      title: String!
      published: Int!
      author: Author!
      genres : [String!]!
      id: ID!
    }
  type Query {
      bookCount : Int!
      authorCount : Int!
      allBooks (genre : String): [Book!]!
      allAuthors : [Author!]!
      me: User
  }
  type Subscription {
    bookAdded : Book!
  }
  type Mutation {
    addBook(title : String!,author : String!,published : Int!, genres : [String!]!) : Book!
    editAuthor(name : String, setBornTo : Int) : Author
    createUser(
      username: String!
      favoriteGenre: String!
    ): User
    login(
      username: String!
      password: String!
    ): Token
  }
`

const resolvers = {
  Query: {
      bookCount : () => Book.collection.countDocuments(),
      authorCount : () => Author.collection.countDocuments(),
      allBooks : (root,args) => {
        if(args.genre)
        return Book.find({genres : {$in : args.genre}}).populate('author')
        else return Book.find().populate('author')
      },
      allAuthors :  () =>  Author.find({}),
      me : (root,args,context) => {
        return context.currentUser
      }
  },
  Author : {
    bookCount : (root)=> Book.count({author : root.id})
  },
  Mutation : {
      addBook : async (root,args,context) =>{
          let author = await Author.findOne({name : args.author})
          const currentUser = context.currentUser

          if(!currentUser){
            throw new AuthenticationError('not authenticate')
          }
          if(!author)
          {
              author = new Author({
                name : args.author,
                born : null
              })
              try{
                await author.save()
              }
              catch(error){
                throw new UserInputError(error.message, {
                  invalidArgs: args,
                })
              }
          }
          const book = new Book({...args, author : author._id})
          try{
            await book.save()
          }
          catch(error){
            throw new UserInputError(error.message, {
              invalidArgs: args,
            })
          }
          const fullObj = await Book.findById(book._id).populate('author')
          pubsub.publish('BOOK_ADDED', { bookAdded: fullObj })
          return fullObj
      },
      editAuthor : async (root,args,context) =>{
        const currentUser = context.currentUser
        if (!currentUser) {
          throw new AuthenticationError("not authenticated")
        }
        const author =await Author.findOne({name : args.name})
        if(!author) throw new UserInputError("no such author in database")
        author.born = args.setBornTo
        try{
          await author.save()
        }
        catch(error){
          throw new UserInputError(error.message,{
            invalidArgs : args,
          })
        }
        return author
      },
      createUser : async (root,args) => {
        const newUser = new User({username : args.username, favoriteGenre : args.favoriteGenre})
        try{
          await newUser.save()
        }
        catch(error){
          throw new UserInputError(error.message,{
            invalidArgs:args,
          })
        }
        return newUser
      },
      login: async (root, args) => {
        const user = await User.findOne({ username: args.username })
    
        if ( !user || args.password !== 'atulie' ) {
          throw new UserInputError("wrong credentials")
        }
    
        const userForToken = {
          username: user.username,
          id: user._id,
        }
    
        return { value: jwt.sign(userForToken, JWT_SECRET) }
      }
  },
  Subscription: {
    bookAdded: {
      subscribe: () => pubsub.asyncIterator(['BOOK_ADDED'])
    },
  }
}

const server = new ApolloServer({
  typeDefs,
  resolvers,
  context : async ({ req }) => {
    const auth = req ? req.headers.authorization : null
    if (auth && auth.toLowerCase().startsWith('bearer ')) {
      const decodedToken = jwt.verify(
        auth.substring(7), JWT_SECRET
      )
      const currentUser = await User.findById(decodedToken.id)
      return { currentUser }
    }
  }
})

server.listen().then(({ url, subscriptionsUrl }) => {
  console.log(`Server ready at ${url}`)
  console.log(`Subscriptions ready at ${subscriptionsUrl}`)
})