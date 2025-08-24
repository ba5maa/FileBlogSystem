FROM mcr.microsoft.com/dotnet/aspnet:10.0-preview AS base
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

# Stage 1: Build the application
FROM mcr.microsoft.com/dotnet/sdk:10.0-preview AS build
WORKDIR /src

# Copy only the project file first (keep folder structure)
COPY ["FileBlogSystem/FileBlogSystem.csproj", "FileBlogSystem/"]

# Restore dependencies
RUN dotnet restore "FileBlogSystem/FileBlogSystem.csproj"

# Copy the rest of the source code
COPY . .

# Build and publish
WORKDIR "/src/FileBlogSystem"
RUN dotnet publish -c Release -o /app/publish

# Final runtime image
FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "FileBlogSystem.dll"]
